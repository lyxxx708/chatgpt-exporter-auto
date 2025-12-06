import { CommandMessage, EventMessage } from '../worker/protocol'
import type { WorkerSlot } from './protocol'

const CHANNEL_NAME = 'chatgpt-ui-worker'

interface PendingTask {
    resolve: (value: { ok: boolean; reply?: string; error?: string }) => void
    reject: (error: any) => void
    slotName: string
}

export class CommandRouter {
    private channel: BroadcastChannel
    private pending = new Map<string, PendingTask>()
    private slots: WorkerSlot[] = []
    private listeners = new Set<(event: EventMessage) => void>()

    constructor() {
        this.channel = new BroadcastChannel(CHANNEL_NAME)
        this.channel.onmessage = ev => this.handleEvent(ev.data as EventMessage)
    }

    dispose() {
        this.channel.close()
    }

    setSlots(slots: WorkerSlot[]) {
        this.slots = slots
    }

    onEvent(cb: (event: EventMessage) => void) {
        this.listeners.add(cb)
        return () => this.listeners.delete(cb)
    }

    sendCommand(workerId: string, command: CommandMessage) {
        this.channel.postMessage({ ...command, targetWorkerId: workerId })
    }

    runPromptOnSlot(runId: string, slotName: string, prompt: string, metadata?: any) {
        const bound = this.slots.find(slot => slot.slotName === slotName)?.boundWorkerId
        if (!bound) {
            return Promise.resolve({ ok: false, error: `No worker bound for slot ${slotName}` })
        }
        const id = `${runId}-${slotName}-${Math.random().toString(36).slice(2, 8)}`
        const payload: CommandMessage = { type: 'RUN_PROMPT', id, prompt, metadata: { ...metadata, runId } }
        this.channel.postMessage({ ...payload, targetWorkerId: bound })
        return new Promise<{ ok: boolean; reply?: string; error?: string }>((resolve, reject) => {
            this.pending.set(id, { resolve, reject, slotName })
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id)
                    resolve({ ok: false, error: 'Timeout waiting for result' })
                }
            }, 120000)
        })
    }

    private handleEvent(event: EventMessage) {
        if (!event || typeof event !== 'object') return
        this.listeners.forEach(cb => cb(event))
        if (event.type === 'RESULT') {
            const pending = this.pending.get(event.id)
            if (pending) {
                this.pending.delete(event.id)
                pending.resolve({ ok: event.ok, reply: event.reply, error: event.error })
            }
        }
    }
}
