import { render } from 'preact'
import sentinel from 'sentinel-js'
import { fetchConversation, processConversation } from './api'
import { getChatIdFromUrl, isSharePage } from './page'
import { Menu } from './ui/Menu'
import { onloadSafe } from './utils/utils'
import { injectAutomationPanel } from './automation/panel'
import { enqueueMessage, enqueueTask } from './automation/automation'
import {
  getPluginConfig,
  setAutoForwardReply,
  setAutoSendEnabled,
  setDelayRange,
  setMaxRetries,
} from './agent/config'
import { getInstanceId, getPersonaId, setPersonaId } from './agent/identity'
import type { AgentReply, AgentTask, PluginConfig } from './agent/types'

import './i18n'
import './styles/missing-tailwind.css'

main()

function main() {
    onloadSafe(() => {
        const styleEl = document.createElement('style')
        styleEl.id = 'sentinel-css'
        document.head.append(styleEl)

        const injectionMap = new Map<HTMLElement, HTMLElement>()

        const injectNavMenu = (nav: HTMLElement) => {
            if (injectionMap.has(nav)) return

            const container = getMenuContainer()
            injectionMap.set(nav, container)

            const chatList = nav.querySelector(':scope > div.sticky.bottom-0')
            if (chatList) {
                chatList.prepend(container)
            }
            else {
                // fallback to the bottom of the nav
                container.style.backgroundColor = '#171717'
                container.style.position = 'sticky'
                container.style.bottom = '72px'
                nav.append(container)
            }
        }

        sentinel.on('nav', injectNavMenu)

        setInterval(() => {
            injectionMap.forEach((container, nav) => {
                if (!nav.isConnected) {
                    container.remove()
                    injectionMap.delete(nav)
                }
            })

            const navList = Array.from(document.querySelectorAll('nav')).filter(nav => !injectionMap.has(nav))
            navList.forEach(injectNavMenu)
        }, 300)

        // Support for share page
        if (isSharePage()) {
            sentinel.on(`div[role="presentation"] > .w-full > div >.flex.w-full`, (target) => {
                target.prepend(getMenuContainer())
            })
        }

        /** Insert timestamp to the bottom right of each message */
        let chatId = ''
        sentinel.on('[role="presentation"]', async () => {
            const currentChatId = getChatIdFromUrl()
            if (!currentChatId || currentChatId === chatId) return
            chatId = currentChatId

            const rawConversation = await fetchConversation(chatId, false)
            const { conversationNodes } = processConversation(rawConversation)

            const threadContents = Array.from(document.querySelectorAll('main [data-testid^="conversation-turn-"] [data-message-id]'))
            if (threadContents.length === 0) return

            threadContents.forEach((thread, index) => {
                const createTime = conversationNodes[index]?.message?.create_time
                if (!createTime) return

                const date = new Date(createTime * 1000)

                const timestamp = document.createElement('time')
                timestamp.className = 'w-full text-gray-500 dark:text-gray-400 text-sm text-right'
                timestamp.dateTime = date.toISOString()
                timestamp.title = date.toLocaleString()

                const hour12 = document.createElement('span')
                hour12.setAttribute('data-time-format', '12')
                hour12.textContent = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                const hour24 = document.createElement('span')
                hour24.setAttribute('data-time-format', '24')
                hour24.textContent = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                timestamp.append(hour12, hour24)
                thread.append(timestamp)
            })
        })

        bootstrapAutomation()
    })
}

function getMenuContainer() {
    const container = document.createElement('div')
    // to overlap on the list section
    container.style.zIndex = '99'
    render(<Menu container={container} />, container)
    return container
}

function injectAutoSendTestButton() {
    const existing = document.getElementById('auto-send-test-button')
    if (existing) return

    const btn = document.createElement('button')
    btn.id = 'auto-send-test-button'
    btn.textContent = 'Auto Send Test'
    btn.style.position = 'fixed'
    btn.style.bottom = '20px'
    btn.style.right = '20px'
    btn.style.zIndex = '9999'
    btn.style.padding = '8px 12px'
    btn.style.background = '#10a37f'
    btn.style.color = '#fff'
    btn.style.borderRadius = '6px'
    btn.style.border = 'none'
    btn.style.cursor = 'pointer'
    btn.style.fontSize = '14px'

    btn.onclick = () => {
        enqueueMessage('这是自动发送的测试消息（来自自动化脚本）')
    }

    document.body.appendChild(btn)
}

function bootstrapAutomation() {
    injectAutoSendTestButton()
    injectAutomationPanel()
    exposeGlobalAutoAgent()
}

function exposeGlobalAutoAgent() {
    const instanceId = getInstanceId()

    const api = {
        instanceId,
        get personaId() {
            return getPersonaId()
        },
        set personaId(value: string) {
            setPersonaId(value)
        },
        getConfig: () => getPluginConfig(),
        setConfig: (partial: Partial<PluginConfig>) => {
            const current = getPluginConfig()
            if (typeof partial.minDelayMs === 'number' || typeof partial.maxDelayMs === 'number') {
                const min = partial.minDelayMs ?? current.minDelayMs
                const max = partial.maxDelayMs ?? current.maxDelayMs
                setDelayRange(min, max)
            }
            if (typeof partial.maxRetries === 'number') {
                setMaxRetries(partial.maxRetries)
            }
            if (typeof partial.autoSendEnabled === 'boolean') {
                setAutoSendEnabled(partial.autoSendEnabled)
            }
            if (typeof partial.autoForwardReply === 'boolean') {
                setAutoForwardReply(partial.autoForwardReply)
            }
        },
        pushTask: (task: AgentTask) => {
            if (!task.personaId) {
                task.personaId = getPersonaId()
            }
            enqueueTask(task)
        },
        pushText: (prompt: string) => {
            enqueueMessage(prompt)
        },
        onReply: undefined as ((reply: AgentReply) => void) | undefined,
    }

    window.AutoAgent = api
}
