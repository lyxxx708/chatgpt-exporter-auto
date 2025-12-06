import { detectUiErrorText, findConversationContainer, findInputParagraph, findInputRoot, findSendButton, getLatestAssistantMessageText } from './domSelectors'
import type { RunPromptResult } from './protocol'

interface WaitOptions {
    timeoutMs?: number
    previousText?: string | null
}

export function fillPrompt(prompt: string): { ok: boolean; error?: string } {
    const root = findInputRoot()
    if (!root) {
        return { ok: false, error: 'input_not_found' }
    }

    const paragraph = findInputParagraph()

    if (paragraph) {
        paragraph.textContent = prompt
    }
    else if ('value' in root) {
        (root as HTMLTextAreaElement).value = prompt
    }
    else {
        root.textContent = prompt
    }

    const evt = new Event('input', { bubbles: true })
    root.dispatchEvent(evt)

    return { ok: true }
}

export function triggerSend(): { ok: boolean; error?: string } {
    const btn = findSendButton()
    if (!btn) {
        return { ok: false, error: 'send_button_not_found' }
    }
    btn.click()
    return { ok: true }
}

function waitForAssistantReply(options: WaitOptions = {}): Promise<string | null> {
    const { timeoutMs = 120000, previousText = null } = options

    return new Promise(resolve => {
        const initial = getLatestAssistantMessageText()
        if (initial && initial !== previousText) {
            resolve(initial)
            return
        }

        const container = findConversationContainer()
        const timeout = setTimeout(() => {
            cleanup()
            resolve(null)
        }, timeoutMs)

        const handlePotentialError = () => {
            const errorText = detectUiErrorText()
            if (errorText) {
                cleanup()
                resolve(`ERROR:${errorText}`)
            }
        }

        const checkLatest = () => {
            const latest = getLatestAssistantMessageText()
            if (latest && latest !== previousText) {
                cleanup()
                resolve(latest)
                return true
            }
            return false
        }

        const observer = new MutationObserver(() => {
            if (checkLatest()) return
            handlePotentialError()
        })

        const cleanup = () => {
            clearTimeout(timeout)
            observer.disconnect()
        }

        if (container) {
            observer.observe(container, { subtree: true, childList: true, characterData: true })
        }
        else {
            resolve(null)
        }
    })
}

export async function runPromptAndWait(prompt: string, options: WaitOptions = {}): Promise<RunPromptResult> {
    const baseline = getLatestAssistantMessageText()
    const fillResult = fillPrompt(prompt)
    if (!fillResult.ok) {
        return fillResult
    }

    const sendResult = triggerSend()
    if (!sendResult.ok) {
        return sendResult
    }

    const reply = await waitForAssistantReply({ ...options, previousText: baseline })
    if (!reply) {
        return { ok: false, error: 'timeout' }
    }

    if (reply.startsWith('ERROR:')) {
        return { ok: false, error: reply.replace('ERROR:', '') }
    }

    return { ok: true, reply }
}
