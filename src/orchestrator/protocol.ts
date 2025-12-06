import type { WorkerStatus } from '../worker/protocol'

export type WorkerSlot = {
    slotName: string
    boundWorkerId?: string
}

export interface WorkerInfoSnapshot {
    workerId: string
    personaLabel: string
    status: WorkerStatus
    queueLength: number
    lastSeenAt: number
    errorCode?: string
    configSnapshot?: Record<string, any>
}

export type ScenarioTemplate = {
    id: string
    name: string
    description?: string
    roles: Array<{
        slotName: string
        defaultSystemPrompt: string
    }>
    stages: ScenarioStage[]
}

export type ScenarioStage = LoopStage | PromptStage | AggregateStage | ArtifactStage

export type LoopStage = {
    kind: 'loop'
    id: string
    maxRounds: number
    stopCondition?: string
    body: ScenarioStage[]
}

export type PromptStage = {
    kind: 'prompt'
    id: string
    targetRole: string
    promptTemplate: string
}

export type AggregateStage = {
    kind: 'aggregate'
    id: string
    targetRole: string
    promptTemplate: string
}

export type ArtifactStage = {
    kind: 'artifact'
    id: string
    mode: 'append' | 'overwrite_section'
    template: string
}

export type ScenarioRunStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

export type ScenarioRun = {
    runId: string
    templateId: string
    createdAt: number
    status: ScenarioRunStatus
    currentStagePath: string[]
    currentRound: number
    lastReplies: Record<string, string>
    centralArtifact: string
    events: ScenarioEvent[]
}

export type ScenarioEvent =
    | { type: 'TASK_ASSIGNED'; time: number; slot: string; workerId: string; taskId: string; promptPreview: string }
    | { type: 'TASK_RESULT'; time: number; slot: string; workerId: string; taskId: string; ok: boolean }
    | { type: 'ARTIFACT_UPDATED'; time: number; diffPreview: string }
    | { type: 'RUN_STATUS'; time: number; from: ScenarioRunStatus; to: ScenarioRunStatus }
    | { type: 'RUN_ERROR'; time: number; message: string }

export interface PersistedTemplatePayload {
    templates: ScenarioTemplate[]
}

export interface PersistedRunSummary {
    runId: string
    templateId: string
    createdAt: number
    status: ScenarioRunStatus
    artifactPreview: string
}
