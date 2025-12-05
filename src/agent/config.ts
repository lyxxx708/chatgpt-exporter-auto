// === v6.1: Agent 配置管理 ===
import type { PluginConfig } from './types'

const config: PluginConfig = {
  minDelayMs: 1500,
  maxDelayMs: 3000,
  maxRetries: 2,
  autoSendEnabled: false,
  autoForwardReply: true,
}

export function getPluginConfig(): PluginConfig {
  return { ...config }
}

export function setDelayRange(minDelayMs: number, maxDelayMs: number) {
  config.minDelayMs = Math.max(0, Math.min(minDelayMs, maxDelayMs))
  config.maxDelayMs = Math.max(config.minDelayMs, maxDelayMs)
}

export function setMaxRetries(maxRetries: number) {
  config.maxRetries = Math.max(0, Math.floor(maxRetries))
}

export function setAutoSendEnabled(enabled: boolean) {
  config.autoSendEnabled = enabled
}

export function setAutoForwardReply(enabled: boolean) {
  config.autoForwardReply = enabled
}
