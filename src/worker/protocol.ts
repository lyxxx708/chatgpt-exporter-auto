export type WorkerStatus = 'idle' | 'busy' | 'cooldown' | 'error'

export interface WorkerTask {
    id: string
    prompt: string
    metadata?: any
    attempts: number
}

export interface WorkerConfig {
    minDelayMs: number
    maxDelayMs: number
    maxRetries: number
    autoProcess: boolean
    autoReloadOnError: boolean
    maxReloadPerSession: number
    reloadCooldownMs: number
}

export type CommandMessage =
    | { type: 'PING'; id: string; targetWorkerId?: string }
    | { type: 'RUN_PROMPT'; id: string; prompt: string; metadata?: any; targetWorkerId?: string }
    | { type: 'CANCEL'; id: string; targetWorkerId?: string }
    | { type: 'SET_CONFIG'; config: Partial<WorkerConfig>; targetWorkerId?: string }
    | { type: 'SET_PERSONA_LABEL'; label: string; targetWorkerId?: string }

export type EventMessage =
    | {
          type: 'HELLO'
          workerId: string
          personaLabel: string
          fromReload?: boolean
          reloadCount?: number
          capabilities: string[]
      }
    | {
          type: 'STATUS'
          workerId: string
          status: WorkerStatus
          activeTaskId?: string
          queueLength: number
          errorCode?: string
      }
    | {
          type: 'RESULT'
          workerId: string
          id: string
          ok: boolean
          reply?: string
          error?: string
          metadata?: any
      }
    | {
          type: 'LOG'
          workerId: string
          level: 'info' | 'warn' | 'error'
          message: string
          detail?: any
      }

export interface RunPromptResult {
    ok: boolean
    reply?: string
    error?: string
}
