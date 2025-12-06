import { ArtifactManager } from './ArtifactManager'
import { CommandRouter } from './CommandRouter'
import { ScenarioRuntime } from './ScenarioRuntime'
import { WorkerRegistry } from './WorkerRegistry'
import { loadRunSummaries, loadTemplates, saveTemplates } from './persistence'
import type {
    RoundSummary,
    ScenarioEvent,
    ScenarioRun,
    ScenarioTemplate,
    ScenarioRunStatus,
    WorkerSlot,
} from './protocol'

export type WorkerInfoView = {
    workerId: string
    personaLabel: string
    slotName?: string
    status: 'idle' | 'busy' | 'cooldown' | 'error'
    queueLength: number
    lastSeenAt: number
    currentTaskId?: string
    errorMessage?: string
}

export type ScenarioTemplateSummary = {
    id: string
    name: string
    description?: string
    roles: string[]
    maxRounds: number
}

export type RunStateView = {
    id: string
    name?: string
    templateId: string
    status: ScenarioRunStatus
    currentRound: number
    maxRounds: number
    currentStagePath: string[]
    centralArtifact: string
    rounds: RoundSummary[]
    events: ScenarioEvent[]
}

export type OrchestratorViewState = {
    currentRun: RunStateView | null
    runsHistory: { runId: string; templateId: string; status: ScenarioRunStatus; createdAt: number; artifactPreview: string }[]
    templates: ScenarioTemplateSummary[]
    workers: WorkerInfoView[]
    events: ScenarioEvent[]
    slots: WorkerSlot[]
}

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
        hooks: {
            shouldStop: 'false',
        },
    },
]

export class OrchestratorEngine {
    readonly registry = new WorkerRegistry()
    readonly router = new CommandRouter()
    readonly artifact = new ArtifactManager()
    readonly runtime = new ScenarioRuntime(this.router, this.artifact, () => this.slots)

    private slots: WorkerSlot[] = []
    private templates: ScenarioTemplate[]
    private listeners = new Set<(state: OrchestratorViewState) => void>()
    private activeRunId?: string
    private runtimeUnsub?: () => void
    private runListeners = new Set<(run?: ScenarioRun) => void>()
    private runsHistory = loadRunSummaries()

    constructor() {
        const stored = loadTemplates()
        this.templates = stored && stored.length > 0 ? stored : DEFAULT_TEMPLATES
        this.runtime.loadTemplates(this.templates)
        this.syncSlotsFromTemplate(this.templates[0])
        this.registry.onWorkersChanged(() => this.notify())
    }

    dispose() {
        this.registry.dispose()
        this.router.dispose()
        this.runtimeUnsub?.()
    }

    subscribe(cb: (state: OrchestratorViewState) => void) {
        this.listeners.add(cb)
        cb(this.getState())
        return () => this.listeners.delete(cb)
    }

    onRunUpdated(cb: (run?: ScenarioRun) => void) {
        this.runListeners.add(cb)
        return () => this.runListeners.delete(cb)
    }

    getState(): OrchestratorViewState {
        const workersRaw = this.registry.getWorkers()
        const workerViews: WorkerInfoView[] = workersRaw.map(info => ({
            workerId: info.workerId,
            personaLabel: info.personaLabel,
            status: info.status,
            queueLength: info.queueLength,
            lastSeenAt: info.lastSeenAt,
            errorMessage: info.errorCode,
            slotName: this.slots.find(s => s.boundWorkerId === info.workerId)?.slotName,
        }))

        const currentRun = this.getActiveRun()
        const templateSummaries: ScenarioTemplateSummary[] = this.templates.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            roles: t.roles.map(r => r.slotName),
            maxRounds: this.deriveMaxRounds(t),
        }))

        return {
            currentRun: currentRun ? this.toRunView(currentRun) : null,
            runsHistory: this.runsHistory,
            templates: templateSummaries,
            workers: workerViews,
            events: currentRun?.events || [],
            slots: this.slots,
        }
    }

    listTemplates() {
        return this.templates
    }

    getTemplate(id: string) {
        return this.templates.find(t => t.id === id)
    }

    updateTemplate(template: ScenarioTemplate) {
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

    setBoundWorker(slotName: string, workerId?: string) {
        this.slots = this.slots.map(slot => (slot.slotName === slotName ? { ...slot, boundWorkerId: workerId || undefined } : slot))
        this.router.setSlots(this.slots)
        this.notify()
    }

    syncSlotsFromTemplate(template: ScenarioTemplate) {
        const existing = this.slots
        this.slots = template.roles.map(role => {
            const prev = existing.find(s => s.slotName === role.slotName)
            return prev ? { ...prev } : { slotName: role.slotName }
        })
        this.router.setSlots(this.slots)
        this.notify()
    }

    startRun(templateId: string, initialArtifact = '', name?: string) {
        const template = this.templates.find(t => t.id === templateId)
        if (template) {
            this.syncSlotsFromTemplate(template)
        }
        const run = this.runtime.createRun(templateId, initialArtifact, name)
        this.activeRunId = run.runId
        this.runtimeUnsub?.()
        this.runtimeUnsub = this.runtime.onRunUpdated(run.runId, r => this.handleRunUpdated(r))
        this.runListeners.forEach(cb => cb(run))
        this.runtime.startRun(run.runId)
        this.notify()
    }

    resumeRun() {
        if (this.activeRunId) {
            this.runtime.startRun(this.activeRunId)
            this.notify()
        }
    }

    pauseRun() {
        if (this.activeRunId) this.runtime.pauseRun(this.activeRunId)
        this.notify()
    }

    stopRun() {
        if (this.activeRunId) this.runtime.stopRun(this.activeRunId)
        this.notify()
    }

    step() {
        // Placeholder for future fine-grained stepping
        this.resumeRun()
    }

    setRunName(name: string) {
        if (!this.activeRunId) return
        const run = this.runtime.getRun(this.activeRunId)
        if (run) {
            run.name = name
            this.notify()
        }
    }

    getActiveRun(): ScenarioRun | undefined {
        return this.activeRunId ? this.runtime.getRun(this.activeRunId) : undefined
    }

    bindSlot(slotName: string, workerId: string | null) {
        this.setBoundWorker(slotName, workerId || undefined)
    }

    private handleRunUpdated(run?: ScenarioRun) {
        if (!run) return
        this.runListeners.forEach(cb => cb(run))
        if (run.status === 'completed' || run.status === 'error') {
            this.runsHistory = loadRunSummaries()
        }
        this.notify()
    }

    private deriveMaxRounds(template: ScenarioTemplate): number {
        const loop = template.stages.find(stage => stage.kind === 'loop') as { maxRounds: number } | undefined
        return loop?.maxRounds || 1
    }

    private toRunView(run: ScenarioRun): RunStateView {
        const template = this.templates.find(t => t.id === run.templateId)
        return {
            id: run.runId,
            name: run.name || template?.name,
            templateId: run.templateId,
            status: run.status,
            currentRound: run.currentRound,
            maxRounds: template ? this.deriveMaxRounds(template) : 0,
            currentStagePath: run.currentStagePath,
            centralArtifact: run.centralArtifact,
            rounds: run.rounds || [],
            events: run.events || [],
        }
    }

    private notify() {
        const snapshot = this.getState()
        this.listeners.forEach(cb => cb(snapshot))
    }
}
