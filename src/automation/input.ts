import { INPUT_SELECTORS, SEND_BUTTON_SELECTORS } from './selectors'

function safeQuerySelector<T extends Element>(selector?: string | null): T | null {
    if (!selector) return null
    try {
        return document.querySelector<T>(selector)
    }
    catch (err) {
        console.warn('[auto-chat] invalid selector', selector, err)
        return null
    }
}

function getInputRoot(): HTMLElement | null {
    const byRoot = safeQuerySelector<HTMLElement>(INPUT_SELECTORS.root)
    if (byRoot) return byRoot

    const byFallback = safeQuerySelector<HTMLElement>(INPUT_SELECTORS.fallbackContainer)
    if (byFallback) return byFallback

    return null
}

function getInputParagraph(): HTMLElement | null {
    const el = safeQuerySelector<HTMLElement>(INPUT_SELECTORS.paragraph)
    if (el) return el
    return null
}

export function fillPrompt(prompt: string): void {
    const root = getInputRoot()
    if (!root) {
        console.warn('[auto-chat] 找不到输入框 root')
        return
    }

    const paragraph = getInputParagraph()

    if (paragraph) {
        paragraph.textContent = prompt
    }
    else {
        if ('value' in root) {
            (root as HTMLTextAreaElement).value = prompt
        }
        else {
            root.textContent = prompt
        }
    }

    const evt = new Event('input', { bubbles: true })
    root.dispatchEvent(evt)
}

function getSendButton(): HTMLButtonElement | null {
    for (const selector of SEND_BUTTON_SELECTORS.candidates) {
        const el = safeQuerySelector<HTMLButtonElement>(selector)
        if (el) return el
    }
    console.error('[auto-chat] send button not found with known selectors')
    return null
}

export function triggerSend(): void {
    const btn = getSendButton()
    if (!btn) {
        console.warn('[auto-chat] 找不到发送按钮')
        return
    }
    btn.click()
}

export function sendOnce(prompt: string): void {
    fillPrompt(prompt)
    triggerSend()
}
