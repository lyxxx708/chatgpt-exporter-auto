import { EventMessage } from '../worker/protocol'
import type { WorkerInfoSnapshot } from './protocol'

const CHANNEL_NAME = 'chatgpt-ui-worker'
const STALE_THRESHOLD_MS = 3 * 60 * 1000

export class WorkerRegistry {
    private channel: BroadcastChannel
    private workers = new Map<string, WorkerInfoSnapshot>()
    private listeners = new Set<() => void>()
    private cleanupTimer: number

    constructor() {
        this.channel = new BroadcastChannel(CHANNEL_NAME)
        this.channel.onmessage = ev => this.handleEvent(ev.data as EventMessage)
        this.cleanupTimer = window.setInterval(() => this.cleanup(), 30000)
    }

    dispose() {
        clearInterval(this.cleanupTimer)
        this.channel.close()
    }

    onWorkersChanged(cb: () => void) {
        this.listeners.add(cb)
        return () => this.listeners.delete(cb)
    }

    getWorkers(): WorkerInfoSnapshot[] {
        return Array.from(this.workers.values()).sort((a, b) => a.personaLabel.localeCompare(b.personaLabel))
    }

    getWorkerById(id: string) {
        return this.workers.get(id)
    }

    private notify() {
        this.listeners.forEach(cb => cb())
    }

    private cleanup() {
        const now = Date.now()
        let removed = false
        this.workers.forEach((info, id) => {
            if (now - info.lastSeenAt > STALE_THRESHOLD_MS) {
                this.workers.delete(id)
                removed = true
            }
        })
        if (removed) this.notify()
    }

    private handleEvent(event: EventMessage) {
        if (!event || typeof event !== 'object' || !('type' in event)) return
        if (event.type === 'HELLO') {
            const snapshot: WorkerInfoSnapshot = {
                workerId: event.workerId,
                personaLabel: event.personaLabel,
                status: 'idle',
                queueLength: 0,
                lastSeenAt: Date.now(),
            }
            this.workers.set(event.workerId, snapshot)
            this.notify()
        }
        if (event.type === 'STATUS') {
            const existing = this.workers.get(event.workerId)
            const snapshot: WorkerInfoSnapshot = {
                workerId: event.workerId,
                personaLabel: existing?.personaLabel || event.workerId,
                status: event.status,
                queueLength: event.queueLength,
                lastSeenAt: Date.now(),
                errorCode: event.errorCode,
                configSnapshot: existing?.configSnapshot,
            }
            this.workers.set(event.workerId, snapshot)
            this.notify()
        }
        if (event.type === 'LOG') {
            const existing = this.workers.get(event.workerId)
            if (existing) {
                existing.lastSeenAt = Date.now()
            }
        }
        if (event.type === 'RESULT') {
            const existing = this.workers.get(event.workerId)
            if (existing) existing.lastSeenAt = Date.now()
        }
    }
}
