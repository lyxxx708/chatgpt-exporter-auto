import { ArtifactManager } from './ArtifactManager'
import { CommandRouter } from './CommandRouter'
import { saveRunSummary } from './persistence'
import type {
    AggregateStage,
    ArtifactStage,
    LoopStage,
    PromptStage,
    ScenarioEvent,
    ScenarioRun,
    ScenarioRunStatus,
    ScenarioStage,
    ScenarioTemplate,
    WorkerSlot,
} from './protocol'

export class ScenarioRuntime {
    private templates = new Map<string, ScenarioTemplate>()
    private runs = new Map<string, ScenarioRun>()
    private listeners = new Map<string, Set<(run: ScenarioRun) => void>>()

    constructor(
        private router: CommandRouter,
        private artifact: ArtifactManager,
        private getSlots: () => WorkerSlot[],
    ) {}

    loadTemplates(templates: ScenarioTemplate[]) {
        this.templates = new Map(templates.map(t => [t.id, t]))
    }

    getTemplates() {
        return Array.from(this.templates.values())
    }

    createRun(templateId: string, initialArtifact = '') {
        const runId = `run_${Date.now().toString(36)}`
        const run: ScenarioRun = {
            runId,
            templateId,
            createdAt: Date.now(),
            status: 'idle',
            currentStagePath: [],
            currentRound: 1,
            lastReplies: {},
            centralArtifact: initialArtifact,
            events: [],
        }
        this.runs.set(runId, run)
        return run
    }

    getRun(runId: string) {
        return this.runs.get(runId)
    }

    onRunUpdated(runId: string, cb: (run: ScenarioRun) => void) {
        let set = this.listeners.get(runId)
        if (!set) {
            set = new Set()
            this.listeners.set(runId, set)
        }
        set.add(cb)
        return () => set?.delete(cb)
    }

    startRun(runId: string) {
        const run = this.runs.get(runId)
        if (!run) return
        if (run.status === 'running') return
        this.transition(run, 'running')
        this.processRun(run).catch(error => {
            console.error('[orchestrator] run failed', error)
            this.pushEvent(run, { type: 'RUN_ERROR', time: Date.now(), message: String(error) })
            this.transition(run, 'error')
        })
    }

    pauseRun(runId: string) {
        const run = this.runs.get(runId)
        if (!run) return
        this.transition(run, 'paused')
    }

    stopRun(runId: string) {
        const run = this.runs.get(runId)
        if (!run) return
        this.transition(run, 'completed')
        saveRunSummary(run)
    }

    handleWorkerResult(_event: { id: string; workerId: string; ok: boolean; reply?: string; error?: string }) {
        // handled inline during runPromptOnSlot promises
        return
    }

    private async processRun(run: ScenarioRun) {
        const template = this.templates.get(run.templateId)
        if (!template) throw new Error('Template not found')
        const ctx = { run }
        await this.executeStages(template.stages, ctx)
        if (run.status === 'running') {
            this.transition(run, 'completed')
            saveRunSummary(run)
        }
    }

    private async executeStages(stages: ScenarioStage[], ctx: { run: ScenarioRun }) {
        for (const stage of stages) {
            if (ctx.run.status !== 'running') break
            ctx.run.currentStagePath = [stage.id]
            if (stage.kind === 'prompt') {
                await this.executePromptStage(stage, ctx.run)
            }
            else if (stage.kind === 'aggregate') {
                await this.executeAggregateStage(stage, ctx.run)
            }
            else if (stage.kind === 'artifact') {
                await this.executeArtifactStage(stage, ctx.run)
            }
            else if (stage.kind === 'loop') {
                await this.executeLoopStage(stage, ctx)
            }
        }
    }

    private async executeLoopStage(stage: LoopStage, ctx: { run: ScenarioRun }) {
        for (let round = ctx.run.currentRound; round <= stage.maxRounds; round++) {
            if (ctx.run.status !== 'running') return
            ctx.run.currentRound = round
            ctx.run.currentStagePath = [stage.id, `round-${round}`]
            await this.executeStages(stage.body, ctx)
            if (ctx.run.status !== 'running') return
            if (stage.stopCondition && this.evaluateCondition(stage.stopCondition, ctx.run)) {
                break
            }
        }
    }

    private async executePromptStage(stage: PromptStage, run: ScenarioRun) {
        const prompt = this.renderTemplate(stage.promptTemplate, run)
        const task = await this.assignPrompt(run, stage.targetRole, prompt)
        if (!task.ok) {
            this.pushEvent(run, { type: 'RUN_ERROR', time: Date.now(), message: task.error || 'unknown' })
            this.transition(run, 'error')
            return
        }
        run.lastReplies[stage.targetRole] = task.reply || ''
    }

    private async executeAggregateStage(stage: AggregateStage, run: ScenarioRun) {
        const prompt = this.renderTemplate(stage.promptTemplate, run)
        const result = await this.assignPrompt(run, stage.targetRole, prompt)
        if (!result.ok) {
            this.pushEvent(run, { type: 'RUN_ERROR', time: Date.now(), message: result.error || 'aggregate failed' })
            this.transition(run, 'error')
            return
        }
        run.lastReplies[stage.targetRole] = result.reply || ''
    }

    private async executeArtifactStage(stage: ArtifactStage, run: ScenarioRun) {
        const rendered = this.renderTemplate(stage.template, run)
        if (stage.mode === 'append') {
            this.artifact.append(run, rendered)
        }
        else {
            this.artifact.overwriteSection(run, stage.id, rendered)
        }
        this.pushEvent(run, { type: 'ARTIFACT_UPDATED', time: Date.now(), diffPreview: rendered.slice(0, 120) })
        this.notify(run)
    }

    private async assignPrompt(run: ScenarioRun, slotName: string, prompt: string) {
        const slots = this.getSlots()
        const bound = slots.find(slot => slot.slotName === slotName)?.boundWorkerId
        if (!bound) {
            return { ok: false, error: `No worker bound for slot ${slotName}` }
        }
        const taskId = `${run.runId}-${slotName}-${Date.now().toString(36)}`
        this.pushEvent(run, {
            type: 'TASK_ASSIGNED',
            time: Date.now(),
            slot: slotName,
            workerId: bound,
            taskId,
            promptPreview: prompt.slice(0, 180),
        })
        this.notify(run)
        const res = await this.router.runPromptOnSlot(run.runId, slotName, prompt, { runId: run.runId, slotName })
        this.pushEvent(run, {
            type: 'TASK_RESULT',
            time: Date.now(),
            slot: slotName,
            workerId: bound,
            taskId,
            ok: res.ok,
        })
        this.notify(run)
        return res
    }

    private evaluateCondition(expr: string, run: ScenarioRun) {
        try {
            // eslint-disable-next-line no-new-func
            const fn = new Function('round', 'lastReplies', 'artifact', `return (${expr})`)
            return !!fn(run.currentRound, run.lastReplies, run.centralArtifact)
        }
        catch (error) {
            console.warn('[orchestrator] failed to eval stopCondition', error)
            return false
        }
    }

    private renderTemplate(template: string, run: ScenarioRun) {
        const vars: Record<string, any> = {
            centralArtifact: run.centralArtifact,
            lastReplies: run.lastReplies,
            round: run.currentRound,
        }
        return template.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
            const path = (key as string).split('.')
            let value: any = vars
            for (const part of path) {
                value = value?.[part]
            }
            return value ?? ''
        })
    }

    private transition(run: ScenarioRun, next: ScenarioRunStatus) {
        const prev = run.status
        run.status = next
        this.pushEvent(run, { type: 'RUN_STATUS', time: Date.now(), from: prev, to: next })
        this.notify(run)
    }

    private pushEvent(run: ScenarioRun, event: ScenarioEvent) {
        run.events.push(event)
    }

    private notify(run: ScenarioRun) {
        const listeners = this.listeners.get(run.runId)
        if (listeners) listeners.forEach(cb => cb(run))
    }
}
