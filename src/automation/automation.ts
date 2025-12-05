import { sendOnce } from './input'
import type { AgentReply, AgentTask } from '../agent/types'
import {
  getPluginConfig,
  setAutoSendEnabled as setAutoSendEnabledConfig,
} from '../agent/config'
import { getInstanceId, getPersonaId } from '../agent/identity'
import { transport } from '../agent/transport'
import { waitForNextReply } from '../agent/replyWatcher'

// === v6.5: 任务队列与调度 ===
const taskQueue: AgentTask[] = []
let isProcessing = false
let nextTimer: number | null = null

export function getQueueSnapshot(): AgentTask[] {
  return [...taskQueue]
}

export function setAutoSendEnabled(enabled: boolean) {
  setAutoSendEnabledConfig(enabled)
  if (enabled) {
    scheduleNext()
  }
  else {
    clearNextTimer()
    isProcessing = false
  }
}

export function enqueueMessage(text: string) {
  enqueueTask({
    taskId: 'local_' + Date.now() + '_' + Math.random().toString(16).slice(2),
    personaId: getPersonaId(),
    prompt: text,
  })
}

export function enqueueTask(task: AgentTask) {
  taskQueue.push(task)
  const cfg = getPluginConfig()
  const shouldAutoSend = typeof task.autoSend === 'boolean' ? task.autoSend : cfg.autoSendEnabled
  if (shouldAutoSend) {
    scheduleNext()
  }
}

export function clearQueue() {
  taskQueue.length = 0
}

export function processQueueManually() {
  if (isProcessing) return
  scheduleNext()
}

function clearNextTimer() {
  if (nextTimer !== null) {
    clearTimeout(nextTimer)
    nextTimer = null
  }
}

function getRandomDelay(): number {
  const { minDelayMs, maxDelayMs } = getPluginConfig()
  const range = Math.max(0, maxDelayMs - minDelayMs)
  return minDelayMs + Math.random() * range
}

function scheduleNext(delayMs = 0) {
  if (nextTimer !== null || isProcessing) return
  nextTimer = window.setTimeout(() => {
    nextTimer = null
    void processNextTask()
  }, delayMs)
}

export async function sendWithRetry(message: string): Promise<void> {
  const cfg = getPluginConfig()
  const maxAttempts = Math.max(1, cfg.maxRetries + 1)
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

async function processNextTask() {
  const cfg = getPluginConfig()
  if (isProcessing) return

  const task = taskQueue.shift()
  if (!task) {
    isProcessing = false
    return
  }

  const shouldProcess = typeof task.autoSend === 'boolean' ? task.autoSend : cfg.autoSendEnabled
  if (!shouldProcess) {
    isProcessing = false
    return
  }

  isProcessing = true

  await sendWithRetry(task.prompt)

  const answerText = await waitForNextReply({ timeoutMs: 120000 })

  const shouldForward = typeof task.autoForwardReply === 'boolean'
    ? task.autoForwardReply
    : cfg.autoForwardReply

  if (shouldForward && answerText) {
    const reply: AgentReply = {
      taskId: task.taskId,
      personaId: task.personaId,
      instanceId: getInstanceId(),
      answerText,
      timestamp: Date.now(),
    }

    await transport.sendReply(reply)
    if (window.AutoAgent && typeof window.AutoAgent.onReply === 'function') {
      window.AutoAgent.onReply(reply)
    }
  }

  isProcessing = false

  const nextDelay = getRandomDelay()
  if (taskQueue.length > 0 && cfg.autoSendEnabled) {
    scheduleNext(nextDelay)
  }
}
