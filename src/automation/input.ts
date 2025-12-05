import { INPUT_SELECTORS, SEND_BUTTON_SELECTORS } from './selectors'

function getInputRoot(): HTMLElement | null {
    const byRoot = document.querySelector(INPUT_SELECTORS.root)
    if (byRoot) return byRoot as HTMLElement

    const byFallback = document.querySelector(INPUT_SELECTORS.fallbackContainer)
    if (byFallback) return byFallback as HTMLElement

    return null
}

function getInputParagraph(): HTMLElement | null {
    const el = document.querySelector(INPUT_SELECTORS.paragraph)
    if (el) return el as HTMLElement
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
    const primary = document.querySelector(SEND_BUTTON_SELECTORS.primary)
    if (primary) return primary as HTMLButtonElement

    const fallback = document.querySelector(SEND_BUTTON_SELECTORS.fallbackContainer)
    if (fallback) return fallback as HTMLButtonElement

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
