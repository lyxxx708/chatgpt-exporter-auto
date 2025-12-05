import { CHANNEL_NAME, type PersonaRoleWorker, type QcpMessage, type TaskResultMessage } from './types'

type Stage = 'needMax' | 'needMin' | 'needSyn' | 'needJudge'

interface WorkerInfo {
  role: PersonaRoleWorker
  tabId: string
}

interface OrchestratorState {
  round: number
  maxRounds: number
  stage: Stage
  isRunning: boolean
  workers: {
    Maximizer?: WorkerInfo
    Minimizer?: WorkerInfo
    Synthesizer?: WorkerInfo
    Judge?: WorkerInfo
  }
  lastMaxReply?: string
  lastMinReply?: string
  lastSynReply?: string
}

// QcpOrchestrator: 协调 Max → Min → Syn → Judge 多人格会议
export class QcpOrchestrator {
  private readonly channel: BroadcastChannel
  private state: OrchestratorState
  private pendingTaskId: string | null = null
  private pendingRole: PersonaRoleWorker | null = null

  constructor() {
    this.channel = new BroadcastChannel(CHANNEL_NAME)
    this.state = {
      round: 1,
      maxRounds: 100,
      stage: 'needMax',
      isRunning: false,
      workers: {},
    }

    this.channel.onmessage = (event) => {
      this.handleMessage(event.data as QcpMessage)
    }
  }

  start() {
    this.state.isRunning = true
    this.state.round = 1
    this.state.stage = 'needMax'
    this.state.lastMaxReply = undefined
    this.state.lastMinReply = undefined
    this.state.lastSynReply = undefined
    this.pendingTaskId = null
    this.pendingRole = null
    void this.dispatchIfReady()
  }

  stop() {
    this.state.isRunning = false
    this.pendingTaskId = null
    this.pendingRole = null
  }

  private handleMessage(message: QcpMessage) {
    if (message.type === 'REGISTER_PERSONA') {
      this.state.workers[message.role] = { role: message.role, tabId: message.tabId }
      if (this.state.isRunning) {
        void this.dispatchIfReady()
      }
      return
    }

    if (message.type === 'TASK_RESULT') {
      this.handleTaskResult(message)
    }
  }

  private handleTaskResult(result: TaskResultMessage) {
    if (!this.state.isRunning) return
    if (this.pendingTaskId !== result.taskId || this.pendingRole !== result.role) return

    switch (result.role) {
      case 'Maximizer':
        this.state.lastMaxReply = result.reply
        this.state.stage = 'needMin'
        break
      case 'Minimizer':
        this.state.lastMinReply = result.reply
        this.state.stage = 'needSyn'
        break
      case 'Synthesizer':
        this.state.lastSynReply = result.reply
        this.state.stage = 'needJudge'
        break
      case 'Judge':
        {
          const hasMarker =
            result.reply.includes('<<<JUDGE_ROUND_UPDATE>>>') &&
            result.reply.includes('<<<JUDGE_ROUND_UPDATE_END>>>')

          if (hasMarker) {
            this.state.stage = 'needMax'
            this.state.round += 1
          }
          else {
            this.state.stage = 'needJudge'
          }
        }
        break
      default:
        break
    }

    this.pendingTaskId = null
    this.pendingRole = null

    if (!this.state.isRunning) return
    if (this.state.round > this.state.maxRounds) {
      this.stop()
      return
    }

    void this.dispatchIfReady(result)
  }

  private async dispatchIfReady(lastResult?: TaskResultMessage) {
    if (!this.state.isRunning) return
    if (this.pendingTaskId) return

    const worker = this.getWorkerForStage(this.state.stage)
    if (!worker) return

    if (this.state.stage === 'needJudge' && lastResult?.role === 'Judge') {
      const hasMarker =
        lastResult.reply.includes('<<<JUDGE_ROUND_UPDATE>>>') &&
        lastResult.reply.includes('<<<JUDGE_ROUND_UPDATE_END>>>')
      if (!hasMarker) {
        console.warn('[qcp-orchestrator] Judge reply missing update markers, re-assigning round')
      }
    }

    const taskId = this.composeTaskId(worker.role, this.state.round)
    const prompt = this.composePrompt(worker.role)
    if (!prompt) return

    const message = {
      type: 'TASK_ASSIGN',
      role: worker.role,
      tabId: worker.tabId,
      taskId,
      prompt,
    } as const

    this.pendingTaskId = taskId
    this.pendingRole = worker.role
    this.channel.postMessage(message)
  }

  private getWorkerForStage(stage: Stage): WorkerInfo | undefined {
    switch (stage) {
      case 'needMax':
        return this.state.workers.Maximizer
      case 'needMin':
        return this.state.workers.Minimizer
      case 'needSyn':
        return this.state.workers.Synthesizer
      case 'needJudge':
        return this.state.workers.Judge
      default:
        return undefined
    }
  }

  private composePrompt(role: PersonaRoleWorker): string | null {
    const { round, lastMaxReply, lastMinReply, lastSynReply } = this.state

    if (role === 'Maximizer') {
      return [
        `Round ${round}: act as the Maximizer.`,
        lastSynReply ? `Previous synthesis: ${lastSynReply}` : 'No previous synthesis available.',
        'Generate an improved proposal to move the discussion forward.',
      ].join('\n')
    }

    if (role === 'Minimizer') {
      const base = lastMaxReply ?? 'No Maximizer output yet.'
      return [
        `Round ${round}: act as the Minimizer.`,
        'Critique the Maximizer output with concise risks and gaps.',
        `Maximizer said: ${base}`,
      ].join('\n')
    }

    if (role === 'Synthesizer') {
      return [
        `Round ${round}: act as the Synthesizer.`,
        `Maximizer said: ${lastMaxReply ?? 'No Maximizer output.'}`,
        `Minimizer said: ${lastMinReply ?? 'No Minimizer output.'}`,
        'Produce a balanced synthesis that reconciles both.',
      ].join('\n')
    }

    if (role === 'Judge') {
      return [
        `Round ${round}: act as the Judge.`,
        `Review the latest synthesis: ${lastSynReply ?? 'No synthesis provided.'}`,
        'Update central_artifact.md accordingly and include markers:',
        '<<<JUDGE_ROUND_UPDATE>>>',
        'Summarize your update here.',
        '<<<JUDGE_ROUND_UPDATE_END>>>',
      ].join('\n')
    }

    return null
  }

  private composeTaskId(role: PersonaRoleWorker, round: number) {
    return `round-${round}-${role.toLowerCase()}`
  }
}
