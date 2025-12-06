import { INPUT_SELECTORS, SEND_BUTTON_SELECTORS } from '../automation/selectors'

const ASSISTANT_MESSAGE_SELECTOR = '[data-message-author-role="assistant"]'
const ERROR_TEXT_SNIPPETS = ['Something went wrong', 'network error', 'Oops!']

export function findInputRoot(): HTMLElement | null {
    const byRoot = document.querySelector(INPUT_SELECTORS.root)
    if (byRoot) return byRoot as HTMLElement

    const byFallback = document.querySelector(INPUT_SELECTORS.fallbackContainer)
    if (byFallback) return byFallback as HTMLElement

    return null
}

export function findInputParagraph(): HTMLElement | null {
    const el = document.querySelector(INPUT_SELECTORS.paragraph)
    if (el) return el as HTMLElement
    return null
}

export function findSendButton(): HTMLButtonElement | null {
    const primary = document.querySelector(SEND_BUTTON_SELECTORS.primary)
    if (primary) return primary as HTMLButtonElement

    const fallback = document.querySelector(SEND_BUTTON_SELECTORS.fallbackContainer)
    if (fallback) return fallback as HTMLButtonElement

    return null
}

export function getAssistantMessageElements(): HTMLElement[] {
    return Array.from(document.querySelectorAll(ASSISTANT_MESSAGE_SELECTOR)) as HTMLElement[]
}

export function getLatestAssistantMessageText(): string | null {
    const messages = getAssistantMessageElements()
    if (!messages.length) return null
    const last = messages[messages.length - 1]
    const text = last.innerText || last.textContent || ''
    const clean = text.trim()
    return clean || null
}

export function findConversationContainer(): HTMLElement | null {
    const main = document.querySelector('main')
    if (main) return main as HTMLElement
    return document.body
}

export function detectUiErrorText(): string | null {
    const errorNodes = Array.from(document.querySelectorAll('main, body')) as HTMLElement[]
    for (const node of errorNodes) {
        const text = node.innerText || ''
        if (!text) continue
        const match = ERROR_TEXT_SNIPPETS.find(snippet => text.toLowerCase().includes(snippet.toLowerCase()))
        if (match) return match
    }
    return null
}
