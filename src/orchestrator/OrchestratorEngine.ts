import { ArtifactManager } from './ArtifactManager'
import { CommandRouter } from './CommandRouter'
import { ScenarioRuntime } from './ScenarioRuntime'
import { WorkerRegistry } from './WorkerRegistry'
import { loadTemplates, saveTemplates } from './persistence'
import type { ScenarioRun, ScenarioTemplate, WorkerSlot } from './protocol'

const DEFAULT_TEMPLATES: ScenarioTemplate[] = [
    {
        id: 'two_role_demo',
        name: 'Two Role Ping Pong',
        description: 'Simple two role conversation for a few rounds',
        roles: [
            { slotName: 'RoleA', defaultSystemPrompt: 'You are role A. Reply concisely.' },
            { slotName: 'RoleB', defaultSystemPrompt: 'You are role B. Reply concisely.' },
        ],
        stages: [
            {
                kind: 'loop',
                id: 'loop-main',
                maxRounds: 3,
                body: [
                    { kind: 'prompt', id: 'prompt-A', targetRole: 'RoleA', promptTemplate: 'Round {{round}}: respond to artifact {{centralArtifact}}' },
                    { kind: 'prompt', id: 'prompt-B', targetRole: 'RoleB', promptTemplate: 'Reply to RoleA: {{lastReplies.RoleA}}' },
                    { kind: 'artifact', id: 'artifact-log', mode: 'append', template: 'Round {{round}}\n- A: {{lastReplies.RoleA}}\n- B: {{lastReplies.RoleB}}' },
                ],
            },
        ],
    },
    {
        id: 'QCP_Hunter_v1',
        name: 'QCP Hunter v1',
        description: 'Demo template with Maximizer/Minimizer/Synthesizer/Judge loop',
        roles: [
            { slotName: 'Maximizer', defaultSystemPrompt: 'You propose expansive ideas.' },
            { slotName: 'Minimizer', defaultSystemPrompt: 'You critique and stress-test ideas.' },
            { slotName: 'Synthesizer', defaultSystemPrompt: 'You merge perspectives into a concise plan.' },
            { slotName: 'Judge', defaultSystemPrompt: 'You evaluate and decide readiness to stop.' },
        ],
        stages: [
            {
                kind: 'loop',
                id: 'loop-core',
                maxRounds: 100,
                stopCondition: 'round >= 100',
                body: [
                    {
                        kind: 'prompt',
                        id: 'maximize',
                        targetRole: 'Maximizer',
                        promptTemplate: 'Round {{round}}: propose next actions based on artifact: {{centralArtifact}}',
                    },
                    {
                        kind: 'prompt',
                        id: 'minimize',
                        targetRole: 'Minimizer',
                        promptTemplate: 'Critique and risks for: {{lastReplies.Maximizer}}',
                    },
                    {
                        kind: 'aggregate',
                        id: 'synthesize',
                        targetRole: 'Synthesizer',
                        promptTemplate: 'Combine proposal and critique. Proposal: {{lastReplies.Maximizer}}\nCritique: {{lastReplies.Minimizer}}',
                    },
                    {
                        kind: 'prompt',
                        id: 'judge',
                        targetRole: 'Judge',
                        promptTemplate: 'Judge the synthesis and decide if loop can stop. Synthesis: {{lastReplies.Synthesizer}}. Say CONTINUE or STOP and why.',
                    },
                    {
                        kind: 'artifact',
                        id: 'append-round',
                        mode: 'append',
                        template:
                            '### Round {{round}}\n- Maximizer: {{lastReplies.Maximizer}}\n- Minimizer: {{lastReplies.Minimizer}}\n- Synthesizer: {{lastReplies.Synthesizer}}\n- Judge: {{lastReplies.Judge}}',
                    },
                ],
            },
        ],
    },
]

export class OrchestratorEngine {
    readonly registry = new WorkerRegistry()
    readonly router = new CommandRouter()
    readonly artifact = new ArtifactManager()
    readonly runtime = new ScenarioRuntime(this.router, this.artifact, () => this.slots)

    private slots: WorkerSlot[] = []
    private templates: ScenarioTemplate[]
    private listeners = new Set<() => void>()
    private activeRunId?: string
    private runListeners = new Set<(run?: ScenarioRun) => void>()
    private runtimeUnsub?: () => void

    constructor() {
        const stored = loadTemplates()
        this.templates = stored || DEFAULT_TEMPLATES
        this.runtime.loadTemplates(this.templates)
        this.syncSlotsFromTemplate(this.templates[0])
    }

    dispose() {
        this.registry.dispose()
        this.router.dispose()
    }

    subscribe(cb: () => void) {
        this.listeners.add(cb)
        return () => this.listeners.delete(cb)
    }

    onRunUpdated(cb: (run?: ScenarioRun) => void) {
        this.runListeners.add(cb)
        return () => this.runListeners.delete(cb)
    }

    getSnapshot() {
        return {
            slots: this.slots,
            workers: this.registry.getWorkers(),
            templates: this.templates,
            activeRun: this.activeRunId ? this.runtime.getRun(this.activeRunId) : undefined,
        }
    }

    setBoundWorker(slotName: string, workerId?: string) {
        this.slots = this.slots.map(slot => (slot.slotName === slotName ? { ...slot, boundWorkerId: workerId } : slot))
        this.router.setSlots(this.slots)
        this.notify()
    }

    syncSlotsFromTemplate(template: ScenarioTemplate) {
        this.slots = template.roles.map(role => ({ slotName: role.slotName }))
        this.router.setSlots(this.slots)
    }

    addOrUpdateTemplate(template: ScenarioTemplate) {
        const exists = this.templates.findIndex(t => t.id === template.id)
        if (exists >= 0) {
            this.templates[exists] = template
        }
        else {
            this.templates.push(template)
        }
        saveTemplates(this.templates)
        this.runtime.loadTemplates(this.templates)
        this.notify()
    }

    startRun(templateId: string, initialArtifact = '') {
        const run = this.runtime.createRun(templateId, initialArtifact)
        this.activeRunId = run.runId
        this.runtimeUnsub?.()
        this.runtimeUnsub = this.runtime.onRunUpdated(run.runId, r => this.runListeners.forEach(cb => cb(r)))
        this.runListeners.forEach(cb => cb(run))
        this.runtime.startRun(run.runId)
        this.notify()
    }

    pauseRun() {
        if (this.activeRunId) this.runtime.pauseRun(this.activeRunId)
        this.notify()
    }

    stopRun() {
        if (this.activeRunId) this.runtime.stopRun(this.activeRunId)
        this.notify()
    }

    getActiveRun(): ScenarioRun | undefined {
        return this.activeRunId ? this.runtime.getRun(this.activeRunId) : undefined
    }

    private notify() {
        this.listeners.forEach(cb => cb())
    }
}
