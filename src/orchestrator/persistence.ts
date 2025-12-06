import type { PersistedRunSummary, ScenarioRun, ScenarioTemplate } from './protocol'

const TEMPLATE_KEY = 'chatgpt-orchestrator-templates'
const RUN_SUMMARY_KEY = 'chatgpt-orchestrator-runs'

export function saveTemplates(templates: ScenarioTemplate[]) {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify({ templates }))
}

export function loadTemplates(): ScenarioTemplate[] | null {
    const raw = localStorage.getItem(TEMPLATE_KEY)
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw)
        return parsed.templates || null
    }
    catch (error) {
        console.warn('[orchestrator] failed to parse templates', error)
        return null
    }
}

export function saveRunSummary(run: ScenarioRun) {
    const raw = localStorage.getItem(RUN_SUMMARY_KEY)
    const list: PersistedRunSummary[] = raw ? JSON.parse(raw) : []
    const summary: PersistedRunSummary = {
        runId: run.runId,
        templateId: run.templateId,
        createdAt: run.createdAt,
        status: run.status,
        artifactPreview: run.centralArtifact.slice(0, 300),
    }
    const next = [summary, ...list].slice(0, 20)
    localStorage.setItem(RUN_SUMMARY_KEY, JSON.stringify(next))
}

export function loadRunSummaries(): PersistedRunSummary[] {
    const raw = localStorage.getItem(RUN_SUMMARY_KEY)
    if (!raw) return []
    try {
        return JSON.parse(raw)
    }
    catch (error) {
        console.warn('[orchestrator] failed to parse run summaries', error)
        return []
    }
}
