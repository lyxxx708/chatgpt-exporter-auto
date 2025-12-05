export type PersonaRole =
  | 'None'
  | 'Coordinator'
  | 'Maximizer'
  | 'Minimizer'
  | 'Synthesizer'
  | 'Judge'

export type PersonaRoleWorker = Exclude<PersonaRole, 'None' | 'Coordinator'>

export const CHANNEL_NAME = 'bsto-qcp-hunter'

export interface RegisterPersonaMessage {
  type: 'REGISTER_PERSONA'
  role: PersonaRoleWorker
  tabId: string
}

export interface TaskAssignMessage {
  type: 'TASK_ASSIGN'
  role: PersonaRoleWorker
  tabId: string
  taskId: string
  prompt: string
}

export interface TaskResultMessage {
  type: 'TASK_RESULT'
  role: PersonaRoleWorker
  tabId: string
  taskId: string
  reply: string
}

export type QcpMessage = RegisterPersonaMessage | TaskAssignMessage | TaskResultMessage
