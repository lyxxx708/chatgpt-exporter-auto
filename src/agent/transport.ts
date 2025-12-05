// === v6.3: 对外通讯接口 ===
import type { AgentReply, AgentTask } from './types'

export interface Transport {
  pullTask: () => Promise<AgentTask | null>
  sendReply: (reply: AgentReply) => Promise<void>
}

export const transport: Transport = {
  async pullTask() {
    return null
  },
  async sendReply(reply: AgentReply) {
    console.log('[auto-agent] sendReply (mock)', reply)
  },
}
