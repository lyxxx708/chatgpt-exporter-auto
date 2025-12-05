import { INPUT_SELECTORS, SEND_BUTTON_SELECTORS } from './selectors'

// === v1.0: 基础输入定位 ===
// 找输入框根节点（#prompt-textarea 或 fallback）
function getInputRoot(): HTMLElement | null {
  const byRoot = document.querySelector(INPUT_SELECTORS.root)
  if (byRoot) return byRoot as HTMLElement

  const byFallback = document.querySelector(INPUT_SELECTORS.fallbackContainer)
  if (byFallback) return byFallback as HTMLElement

  return null
}

// 找内部的 <p>，有则优先填到 <p>，没有就填 root
function getInputParagraph(): HTMLElement | null {
  const el = document.querySelector(INPUT_SELECTORS.paragraph)
  if (el) return el as HTMLElement
  return null
}

// 写入 prompt 文本
export function fillPrompt(prompt: string): boolean {
  const root = getInputRoot()
  if (!root) {
    console.warn('[auto-chat] 找不到输入框 root')
    return false
  }

  const paragraph = getInputParagraph()

  if (paragraph) {
    // contentEditable 容器里有 <p> 节点：写入它
    paragraph.textContent = prompt
  }
  else {
    // 兜底：直接写 root
    if ('value' in root) {
      (root as HTMLTextAreaElement).value = prompt
    }
    else {
      root.textContent = prompt
    }
  }

  // 触发 input 事件，让 React/前端框架知道内容变了
  const evt = new Event('input', { bubbles: true })
  root.dispatchEvent(evt)
  return true
}

// 找发送按钮
function getSendButton(): HTMLButtonElement | null {
  const primary = document.querySelector(SEND_BUTTON_SELECTORS.primary)
  if (primary) return primary as HTMLButtonElement

  const fallback = document.querySelector(SEND_BUTTON_SELECTORS.fallbackContainer)
  if (fallback) return fallback as HTMLButtonElement

  return null
}

// 点击发送
export function triggerSend(): boolean {
  const btn = getSendButton()
  if (!btn) {
    console.warn('[auto-chat] 找不到发送按钮')
    return false
  }
  btn.click()
  return true
}

// 对外暴露一个“发一次消息”的函数
// === v1.1: 公开 sendOnce ===
export function sendOnce(prompt: string): boolean {
  const filled = fillPrompt(prompt)
  const sent = filled ? triggerSend() : false
  return Boolean(filled && sent)
}
