import { waitForNextReply } from '../agent/replyWatcher'
import { sendOnce } from '../automation/input'
import { getQcpTabId, getStoredPersonaRole, isWorkerRole, onPersonaRoleChange } from './roles'
import type { PersonaRole, PersonaRoleWorker, QcpMessage, TaskAssignMessage, TaskResultMessage } from './types'
import { CHANNEL_NAME } from './types'

// PersonaWorker: 注册 worker 角色，接收任务并通过 sendOnce 执行，再把回复发送回 BroadcastChannel
export class PersonaWorker {
  private role: PersonaRole
  private channel: BroadcastChannel | null = null
  private readonly tabId: string

  constructor() {
    this.role = getStoredPersonaRole()
    this.tabId = getQcpTabId()

    if (isWorkerRole(this.role)) {
      this.setupChannel()
    }

    onPersonaRoleChange((role) => {
      this.role = role
      this.teardownChannel()
      if (isWorkerRole(role)) {
        this.setupChannel()
      }
    })
  }

  private setupChannel() {
    this.channel = new BroadcastChannel(CHANNEL_NAME)
    this.channel.onmessage = (event) => {
      this.handleMessage(event.data as QcpMessage)
    }

    this.channel.postMessage({
      type: 'REGISTER_PERSONA',
      role: this.role as PersonaRoleWorker,
      tabId: this.tabId,
    }) satisfies QcpMessage
  }

  private teardownChannel() {
    if (this.channel) {
      this.channel.close()
      this.channel = null
    }
  }

  private handleMessage(message: QcpMessage) {
    if (message.type !== 'TASK_ASSIGN') return
    if (!this.channel) return

    const assign = message as TaskAssignMessage
    if (assign.tabId !== this.tabId) return
    if (assign.role !== this.role) return

    const sent = sendOnce(assign.prompt)
    if (!sent) {
      console.warn('[qcp-worker] sendOnce failed, skip task', assign.taskId)
      return
    }

    void this.captureAndReply(assign)
  }

  private async captureAndReply(assign: TaskAssignMessage) {
    const replyText = await waitForNextReply({ timeoutMs: 120000 })
    if (!replyText || !this.channel) return

    const result: TaskResultMessage = {
      type: 'TASK_RESULT',
      role: assign.role,
      tabId: this.tabId,
      taskId: assign.taskId,
      reply: replyText,
    }

    this.channel.postMessage(result)
  }
}
