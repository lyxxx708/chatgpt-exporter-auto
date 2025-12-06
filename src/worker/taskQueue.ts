import type { RunPromptResult, WorkerConfig, WorkerStatus, WorkerTask } from './protocol'

export interface TaskQueueCallbacks {
    onStatusChange: (status: WorkerStatus, activeTaskId?: string, errorCode?: string) => void
    onResult: (task: WorkerTask, result: RunPromptResult) => void
    onLog?: (level: 'info' | 'warn' | 'error', message: string, detail?: any) => void
}

export class TaskQueue {
    private tasks: WorkerTask[] = []
    private processing = false
    private processor: (task: WorkerTask) => Promise<RunPromptResult>
    private getConfig: () => WorkerConfig
    private callbacks: TaskQueueCallbacks
    private activeTaskId?: string

    constructor(
        getConfig: () => WorkerConfig,
        processor: (task: WorkerTask) => Promise<RunPromptResult>,
        callbacks: TaskQueueCallbacks,
    ) {
        this.getConfig = getConfig
        this.processor = processor
        this.callbacks = callbacks
    }

    enqueue(task: Omit<WorkerTask, 'attempts'>) {
        this.tasks.push({ ...task, attempts: 0 })
        this.callbacks.onStatusChange(this.processing ? 'busy' : 'idle', this.activeTaskId)
        if (this.getConfig().autoProcess) {
            this.process()
        }
    }

    cancel(id: string) {
        const index = this.tasks.findIndex(t => t.id === id)
        if (index >= 0) {
            this.tasks.splice(index, 1)
            this.callbacks.onLog?.('info', 'Task canceled', { id })
        }
    }

    size() {
        return this.tasks.length
    }

    isProcessing() {
        return this.processing
    }

    async process() {
        if (this.processing) return
        this.processing = true
        while (this.tasks.length) {
            const task = this.tasks.shift()!
            this.activeTaskId = task.id
            const { maxRetries, minDelayMs, maxDelayMs } = this.getConfig()
            this.callbacks.onStatusChange('busy', task.id)

            let attempt = 0
            let result: RunPromptResult = { ok: false, error: 'unknown' }

            while (attempt <= maxRetries) {
                attempt += 1
                task.attempts = attempt
                result = await this.processor(task)
                if (result.ok) break

                if (attempt <= maxRetries) {
                    this.callbacks.onStatusChange('cooldown', task.id, result.error)
                    const delay = getRandomDelay(minDelayMs, maxDelayMs)
                    this.callbacks.onLog?.('warn', 'Retrying task', { id: task.id, attempt, delay, error: result.error })
                    await wait(delay)
                    this.callbacks.onStatusChange('busy', task.id)
                }
            }

            this.callbacks.onResult(task, result)

            if (!result.ok) {
                this.callbacks.onStatusChange('error', task.id, result.error)
            }
            else {
                this.callbacks.onStatusChange('idle')
            }

            const delay = getRandomDelay(minDelayMs, maxDelayMs)
            this.callbacks.onLog?.('info', 'Task processed', { id: task.id, result })
            await wait(delay)
        }
        this.activeTaskId = undefined
        this.processing = false
        this.callbacks.onStatusChange('idle')
    }
}

function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function getRandomDelay(min: number, max: number) {
    if (max <= min) return min
    return Math.floor(Math.random() * (max - min + 1)) + min
}
