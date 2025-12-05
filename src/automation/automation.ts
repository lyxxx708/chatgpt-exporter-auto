import { sendOnce } from './input'

// === v2.0: 消息队列与配置 ===
export type AutomationConfig = {
  minDelayMs: number
  maxDelayMs: number
  maxRetries: number
  autoSendEnabled: boolean
}

const config: AutomationConfig = {
  minDelayMs: 1500,
  maxDelayMs: 3000,
  maxRetries: 2,
  autoSendEnabled: false,
}

const messageQueue: string[] = []
let isProcessing = false
let nextTimer: number | null = null

export function getAutomationConfig(): AutomationConfig {
  return { ...config }
}

export function setDelayRange(minDelayMs: number, maxDelayMs: number) {
  // === v5.0: UI 可配置延迟 ===
  config.minDelayMs = Math.max(0, Math.min(minDelayMs, maxDelayMs))
  config.maxDelayMs = Math.max(config.minDelayMs, maxDelayMs)
}

export function setMaxRetries(maxRetries: number) {
  // === v5.0: UI 可配置重试次数 ===
  config.maxRetries = Math.max(0, Math.floor(maxRetries))
}

export function setAutoSendEnabled(enabled: boolean) {
  // === v5.0: 自动发送开关 ===
  config.autoSendEnabled = enabled
  if (enabled) {
    scheduleNext()
  }
  else {
    clearNextTimer()
    isProcessing = false
  }
}

export function enqueueMessage(text: string) {
  // === v2.1: 入队接口 ===
  messageQueue.push(text)
  if (config.autoSendEnabled) {
    scheduleNext()
  }
}

export function clearQueue() {
  // === v2.2: 队列清空 ===
  messageQueue.length = 0
}

export function getQueueSnapshot() {
  return [...messageQueue]
}

function clearNextTimer() {
  if (nextTimer) {
    clearTimeout(nextTimer)
    nextTimer = null
  }
}

function scheduleNext(delayMs = 0) {
  // === v4.0: setTimeout 链式调度 ===
  if (nextTimer !== null || isProcessing) return
  nextTimer = window.setTimeout(() => {
    nextTimer = null
    processNextInQueue()
  }, delayMs)
}

function getRandomDelay(): number {
  // === v4.1: 随机延迟 ===
  const { minDelayMs, maxDelayMs } = config
  const range = Math.max(0, maxDelayMs - minDelayMs)
  return minDelayMs + Math.random() * range
}

async function processNextInQueue() {
  // === v2.3: 队列调度 ===
  if (!config.autoSendEnabled) {
    isProcessing = false
    return
  }

  const next = messageQueue.shift()
  if (!next) {
    isProcessing = false
    return
  }

  isProcessing = true

  await sendWithRetry(next)

  isProcessing = false
  if (config.autoSendEnabled && messageQueue.length > 0) {
    scheduleNext(getRandomDelay())
  }
}

export async function sendWithRetry(message: string): Promise<void> {
  // === v3.0: 重试封装 ===
  const maxAttempts = Math.max(1, config.maxRetries + 1)
  let attempt = 0

  return new Promise((resolve) => {
    const trySend = () => {
      attempt += 1
      const success = sendOnce(message)

      if (success || attempt >= maxAttempts) {
        resolve()
        return
      }

      const delay = getRandomDelay()
      window.setTimeout(trySend, delay)
    }

    trySend()
  })
}

// === v2.4: 手动触发处理（供 UI 调用） ===
export function processQueueManually() {
  if (!config.autoSendEnabled) return
  if (isProcessing) return
  scheduleNext()
}
