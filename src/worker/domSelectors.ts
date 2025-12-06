import { INPUT_SELECTORS, SEND_BUTTON_SELECTORS } from '../automation/selectors'

const ASSISTANT_MESSAGE_SELECTOR = '[data-message-author-role="assistant"]'
const ERROR_TEXT_SNIPPETS = ['Something went wrong', 'network error', 'Oops!']

function safeQuerySelector<T extends Element>(selector?: string | null): T | null {
    if (!selector) return null
    try {
        return document.querySelector<T>(selector)
    }
    catch (err) {
        console.warn('[ChatGPT Exporter] invalid selector', selector, err)
        return null
    }
}

export function findInputRoot(): HTMLElement | null {
    const byRoot = safeQuerySelector<HTMLElement>(INPUT_SELECTORS.root)
    if (byRoot) return byRoot

    const byFallback = safeQuerySelector<HTMLElement>(INPUT_SELECTORS.fallbackContainer)
    if (byFallback) return byFallback

    return null
}

export function findInputParagraph(): HTMLElement | null {
    const el = safeQuerySelector<HTMLElement>(INPUT_SELECTORS.paragraph)
    if (el) return el
    return null
}

export function findSendButton(): HTMLButtonElement | null {
    for (const selector of SEND_BUTTON_SELECTORS.candidates) {
        const el = safeQuerySelector<HTMLButtonElement>(selector)
        if (el) return el
    }
    console.error('[ChatGPT Exporter] send button not found with known selectors')
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
