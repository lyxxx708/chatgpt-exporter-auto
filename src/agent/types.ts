// === v6.0: Agent 类型定义 ===

export type AgentTask = {
  taskId: string
  personaId: string
  prompt: string
  meta?: Record<string, any>

  autoSend?: boolean
  autoForwardReply?: boolean
}

export type AgentReply = {
  taskId: string
  personaId: string
  instanceId: string
  answerText: string
  rawHtml?: string
  timestamp: number
}

export type PluginConfig = {
  minDelayMs: number
  maxDelayMs: number
  maxRetries: number
  autoSendEnabled: boolean
  autoForwardReply: boolean
}

export type AutoAgentAPI = {
  instanceId: string
  get personaId(): string
  set personaId(value: string)
  getConfig: () => PluginConfig
  setConfig: (partial: Partial<PluginConfig>) => void
  pushTask: (task: AgentTask) => void
  pushText: (prompt: string) => void
  onReply?: (reply: AgentReply) => void
}

declare global {
  interface Window {
    AutoAgent?: AutoAgentAPI
  }
}
