import { runPromptAndWait } from './domRunner'
import { TaskQueue } from './taskQueue'
import type { CommandMessage, EventMessage, RunPromptResult, WorkerConfig, WorkerStatus, WorkerTask } from './protocol'

const CHANNEL_NAME = 'chatgpt-ui-worker'
const WORKER_ID_KEY = 'chatgpt-ui-worker-id'
const WORKER_CONFIG_KEY = 'chatgpt-ui-worker-config'
const PERSONA_LABEL_KEY = 'chatgpt-ui-worker-persona'
const RELOAD_COUNT_KEY = 'chatgpt-ui-worker-reload-count'
const LAST_RELOAD_KEY = 'chatgpt-ui-worker-last-reload'
const FROM_RELOAD_FLAG = 'chatgpt-ui-worker-from-reload'

export class ChatgptUiWorker {
    private channel: BroadcastChannel
    private queue: TaskQueue
    private status: WorkerStatus = 'idle'
    private config: WorkerConfig
    private workerId: string
    private personaLabel: string
    private reloadCount: number
    private fromReload: boolean
    private lastReloadAt?: number
    private listeners = new Set<(event: EventMessage) => void>()

    constructor() {
        this.workerId = this.restoreWorkerId()
        this.personaLabel = this.restorePersonaLabel()
        const reloadInfo = this.restoreReloadInfo()
        this.reloadCount = reloadInfo.reloadCount
        this.fromReload = reloadInfo.fromReload
        this.lastReloadAt = reloadInfo.lastReloadAt

        this.config = this.restoreConfig()

        this.channel = new BroadcastChannel(CHANNEL_NAME)
        this.channel.onmessage = ev => this.handleCommand(ev.data as CommandMessage)

        this.queue = new TaskQueue(
            () => this.config,
            (task: WorkerTask) => this.executeTask(task),
            {
                onStatusChange: (status, activeTaskId, errorCode) => this.updateStatus(status, activeTaskId, errorCode),
                onResult: (task, result) => this.handleResult(task, result),
                onLog: (level, message, detail) => this.log(level, message, detail),
            },
        )

        this.sendHello()
        this.updateStatus('idle')
    }

    onEvent(listener: (event: EventMessage) => void) {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    enqueue(task: Omit<WorkerTask, 'attempts'>) {
        this.queue.enqueue(task)
        this.emitStatus()
    }

    cancel(id: string) {
        this.queue.cancel(id)
        this.emitStatus()
    }

    processOnce() {
        this.queue.process()
    }

    getState() {
        return {
            workerId: this.workerId,
            personaLabel: this.personaLabel,
            status: this.status,
            queueLength: this.queueSize(),
            config: this.config,
            reloadCount: this.reloadCount,
        }
    }

    updateConfig(next: Partial<WorkerConfig>) {
        this.config = { ...this.config, ...next }
        localStorage.setItem(WORKER_CONFIG_KEY, JSON.stringify(this.config))
        this.emitStatus()
    }

    setPersonaLabel(label: string) {
        this.personaLabel = label
        localStorage.setItem(PERSONA_LABEL_KEY, label)
        this.emitStatus()
        this.sendEvent({
            type: 'HELLO',
            workerId: this.workerId,
            personaLabel: this.personaLabel,
            fromReload: this.fromReload,
            reloadCount: this.reloadCount,
            capabilities: this.capabilities,
        })
    }

    private queueSize() {
        return this.queue.size()
    }

    private get capabilities() {
        return ['run_prompt', 'queue', 'status', 'broadcast_channel']
    }

    private sendHello() {
        this.sendEvent({
            type: 'HELLO',
            workerId: this.workerId,
            personaLabel: this.personaLabel,
            fromReload: this.fromReload,
            reloadCount: this.reloadCount,
            capabilities: this.capabilities,
        })
    }

    private restoreWorkerId() {
        const existing = localStorage.getItem(WORKER_ID_KEY)
        if (existing) return existing
        const generated = `inst_${Math.random().toString(36).slice(2, 8)}`
        localStorage.setItem(WORKER_ID_KEY, generated)
        return generated
    }

    private restorePersonaLabel() {
        return localStorage.getItem(PERSONA_LABEL_KEY) || ''
    }

    private restoreConfig(): WorkerConfig {
        const stored = localStorage.getItem(WORKER_CONFIG_KEY)
        const defaults: WorkerConfig = {
            minDelayMs: 1000,
            maxDelayMs: 4000,
            maxRetries: 2,
            autoProcess: true,
            autoReloadOnError: false,
            maxReloadPerSession: 2,
            reloadCooldownMs: 30000,
        }

        if (stored) {
            try {
                return { ...defaults, ...JSON.parse(stored) }
            }
            catch (error) {
                console.warn('[worker] failed to parse config', error)
            }
        }
        return defaults
    }

    private restoreReloadInfo() {
        const reloadCount = Number(sessionStorage.getItem(RELOAD_COUNT_KEY) || '0')
        const fromReload = sessionStorage.getItem(FROM_RELOAD_FLAG) === '1'
        const lastReloadAt = Number(sessionStorage.getItem(LAST_RELOAD_KEY) || '0') || undefined
        sessionStorage.setItem(FROM_RELOAD_FLAG, '')
        return { reloadCount, fromReload, lastReloadAt }
    }

    private handleCommand(command: CommandMessage) {
        if (command.targetWorkerId && command.targetWorkerId !== this.workerId) {
            return
        }
        switch (command.type) {
            case 'PING':
                this.emitStatus()
                break
            case 'RUN_PROMPT':
                this.enqueue({ id: command.id, prompt: command.prompt, metadata: command.metadata })
                break
            case 'CANCEL':
                this.cancel(command.id)
                break
            case 'SET_CONFIG':
                this.updateConfig(command.config)
                break
            case 'SET_PERSONA_LABEL':
                this.setPersonaLabel(command.label)
                break
            default:
                break
        }
    }

    private async executeTask(task: WorkerTask): Promise<RunPromptResult> {
        return runPromptAndWait(task.prompt)
    }

    private handleResult(task: WorkerTask, result: RunPromptResult) {
        this.sendEvent({
            type: 'RESULT',
            workerId: this.workerId,
            id: task.id,
            ok: result.ok,
            reply: result.reply,
            error: result.error,
            metadata: task.metadata,
        })
    }

    private updateStatus(status: WorkerStatus, activeTaskId?: string, errorCode?: string) {
        this.status = status
        this.sendEvent({
            type: 'STATUS',
            workerId: this.workerId,
            status,
            activeTaskId,
            queueLength: this.queueSize(),
            errorCode,
        })

        if (status === 'error' && errorCode) {
            this.maybeReload(errorCode)
        }
    }

    private emitStatus() {
        this.sendEvent({
            type: 'STATUS',
            workerId: this.workerId,
            status: this.status,
            activeTaskId: undefined,
            queueLength: this.queueSize(),
        })
    }

    private handleError(errorCode: string) {
        this.updateStatus('error', undefined, errorCode)
    }

    private log(level: 'info' | 'warn' | 'error', message: string, detail?: any) {
        this.sendEvent({ type: 'LOG', workerId: this.workerId, level, message, detail })
    }

    private maybeReload(reason: string) {
        const { autoReloadOnError, maxReloadPerSession, reloadCooldownMs } = this.config
        const now = Date.now()
        if (!autoReloadOnError) return
        if (this.reloadCount >= maxReloadPerSession) return
        if (this.lastReloadAt && now - this.lastReloadAt < reloadCooldownMs) return

        this.log('warn', 'Auto reload triggered', { reason })
        this.reloadCount += 1
        this.lastReloadAt = now
        sessionStorage.setItem(RELOAD_COUNT_KEY, String(this.reloadCount))
        sessionStorage.setItem(LAST_RELOAD_KEY, String(now))
        sessionStorage.setItem(FROM_RELOAD_FLAG, '1')
        setTimeout(() => {
            location.reload()
        }, 600)
    }

    private sendEvent(event: EventMessage) {
        this.channel.postMessage(event)
        this.listeners.forEach(cb => cb(event))
    }
}
