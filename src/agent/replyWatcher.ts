// === v6.4: 监听回复 ===

type WaitOptions = {
  timeoutMs: number
}

let lastSeenMessageKey: string | null = null

export function waitForNextReply(options: WaitOptions): Promise<string | null> {
  const { timeoutMs } = options

  return new Promise((resolve) => {
    const container = findConversationContainer()
    if (!container) {
      resolve(null)
      return
    }

    const timer = window.setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeoutMs)

    const observer = new MutationObserver(() => {
      const latest = findLatestAssistantMessage()
      if (!latest) return

      const key = latest.getAttribute('data-message-id') || latest.innerText.slice(0, 32)

      if (key === lastSeenMessageKey) return

      lastSeenMessageKey = key
      const text = latest.innerText
      window.clearTimeout(timer)
      observer.disconnect()
      resolve(text)
    })

    observer.observe(container, {
      childList: true,
      subtree: true,
    })
  })
}

function findConversationContainer(): HTMLElement | null {
  // === v6.4.1: 对话容器选择 ===
  const byTestId = document.querySelector('[data-testid="conversation-turns"]')
  if (byTestId) return byTestId as HTMLElement
  return document.querySelector('main')
}

function findLatestAssistantMessage(): HTMLElement | null {
  // === v6.4.2: assistant 消息节点 ===
  const nodes = document.querySelectorAll('[data-message-author-role="assistant"]')
  if (!nodes.length) return null
  return nodes[nodes.length - 1] as HTMLElement
}
