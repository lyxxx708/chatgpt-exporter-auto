import {
  clearQueue,
  enqueueMessage,
  getQueueSnapshot,
  processQueueManually,
  setAutoSendEnabled,
} from './automation'
import {
  getPluginConfig,
  setAutoForwardReply,
  setDelayRange,
  setMaxRetries,
} from '../agent/config'
import { getPersonaId, setPersonaId } from '../agent/identity'
import { getStoredPersonaRole, setStoredPersonaRole } from '../orchestrator/roles'
import type { PersonaRole } from '../orchestrator/types'

// === v6.6: 控制面板 UI 与配置 ===
export function injectAutomationPanel() {
  const existing = document.getElementById('auto-send-control-panel')
  if (existing) return

  const panel = document.createElement('div')
  panel.id = 'auto-send-control-panel'
  panel.style.position = 'fixed'
  panel.style.bottom = '70px'
  panel.style.right = '20px'
  panel.style.zIndex = '10000'
  panel.style.width = '260px'
  panel.style.padding = '12px'
  panel.style.background = '#1f2937'
  panel.style.color = '#f9fafb'
  panel.style.borderRadius = '8px'
  panel.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'
  panel.style.fontSize = '12px'
  panel.style.display = 'flex'
  panel.style.flexDirection = 'column'
  panel.style.gap = '8px'

  const title = document.createElement('div')
  title.textContent = 'Auto Send Control'
  title.style.fontWeight = 'bold'
  title.style.fontSize = '13px'
  panel.appendChild(title)

  const textarea = document.createElement('textarea')
  textarea.id = 'auto-send-textarea'
  textarea.placeholder = '要发送的内容（每次入队一条）'
  textarea.style.width = '100%'
  textarea.style.height = '60px'
  textarea.style.resize = 'vertical'
  textarea.style.padding = '6px'
  textarea.style.borderRadius = '6px'
  textarea.style.border = '1px solid #374151'
  textarea.style.background = '#111827'
  textarea.style.color = '#f9fafb'
  panel.appendChild(textarea)

  const enqueueBtn = document.createElement('button')
  enqueueBtn.textContent = 'Enqueue Message'
  applyButtonStyle(enqueueBtn)
  enqueueBtn.onclick = () => {
    if (!textarea.value.trim()) return
    enqueueMessage(textarea.value)
    textarea.value = ''
    updateQueueLabel()
  }
  panel.appendChild(enqueueBtn)

  const autoSendToggle = document.createElement('label')
  autoSendToggle.style.display = 'flex'
  autoSendToggle.style.alignItems = 'center'
  autoSendToggle.style.gap = '6px'
  const autoSendCheckbox = document.createElement('input')
  autoSendCheckbox.type = 'checkbox'
  autoSendCheckbox.onchange = () => {
    setAutoSendEnabled(autoSendCheckbox.checked)
    if (autoSendCheckbox.checked) {
      processQueueManually()
    }
  }
  autoSendToggle.append(autoSendCheckbox, document.createTextNode('Auto send queue'))
  panel.appendChild(autoSendToggle)

  const autoForwardToggle = document.createElement('label')
  autoForwardToggle.style.display = 'flex'
  autoForwardToggle.style.alignItems = 'center'
  autoForwardToggle.style.gap = '6px'
  const autoForwardCheckbox = document.createElement('input')
  autoForwardCheckbox.type = 'checkbox'
  autoForwardCheckbox.onchange = () => {
    setAutoForwardReply(autoForwardCheckbox.checked)
  }
  autoForwardToggle.append(autoForwardCheckbox, document.createTextNode('Auto forward replies'))
  panel.appendChild(autoForwardToggle)

  const personaWrapper = document.createElement('div')
  personaWrapper.style.display = 'flex'
  personaWrapper.style.flexDirection = 'column'
  personaWrapper.style.gap = '4px'

  const personaLabel = document.createElement('label')
  personaLabel.textContent = 'Persona ID'
  personaLabel.style.fontSize = '11px'

  const personaInput = document.createElement('input')
  personaInput.type = 'text'
  personaInput.style.width = '100%'
  personaInput.style.padding = '6px'
  personaInput.style.borderRadius = '6px'
  personaInput.style.border = '1px solid #374151'
  personaInput.style.background = '#111827'
  personaInput.style.color = '#f9fafb'
  personaInput.onchange = () => {
    setPersonaId(personaInput.value.trim() || 'default')
    personaInput.value = getPersonaId()
  }
  personaWrapper.append(personaLabel, personaInput)
  panel.appendChild(personaWrapper)

  const delayRow = document.createElement('div')
  delayRow.style.display = 'flex'
  delayRow.style.justifyContent = 'space-between'
  delayRow.style.gap = '6px'

  const minDelayInput = createNumberInput('min-delay', 'Min delay (ms)')
  const maxDelayInput = createNumberInput('max-delay', 'Max delay (ms)')
  minDelayInput.input.onchange = () => syncDelayInputs(minDelayInput.input, maxDelayInput.input)
  maxDelayInput.input.onchange = () => syncDelayInputs(minDelayInput.input, maxDelayInput.input)
  delayRow.append(minDelayInput.wrapper, maxDelayInput.wrapper)
  panel.appendChild(delayRow)

  const retryInput = createNumberInput('retry-count', 'Retries')
  retryInput.input.onchange = () => {
    const value = Number(retryInput.input.value)
    setMaxRetries(Number.isFinite(value) ? value : 0)
  }
  panel.appendChild(retryInput.wrapper)

  const roleWrapper = document.createElement('div')
  roleWrapper.style.display = 'flex'
  roleWrapper.style.flexDirection = 'column'
  roleWrapper.style.gap = '4px'

  const roleLabel = document.createElement('label')
  roleLabel.textContent = 'QCP Persona Role'
  roleLabel.style.fontSize = '11px'

  const roleSelect = document.createElement('select')
  roleSelect.style.width = '100%'
  roleSelect.style.padding = '6px'
  roleSelect.style.borderRadius = '6px'
  roleSelect.style.border = '1px solid #374151'
  roleSelect.style.background = '#111827'
  roleSelect.style.color = '#f9fafb'

  const roles: { label: string; value: string }[] = [
    { label: 'None', value: 'None' },
    { label: 'Coordinator', value: 'Coordinator' },
    { label: 'Maximizer', value: 'Maximizer' },
    { label: 'Minimizer', value: 'Minimizer' },
    { label: 'Synthesizer', value: 'Synthesizer' },
    { label: 'Judge', value: 'Judge' },
  ]

  roles.forEach((item) => {
    const option = document.createElement('option')
    option.value = item.value
    option.textContent = item.label
    roleSelect.appendChild(option)
  })

  roleSelect.onchange = () => {
    setStoredPersonaRole(roleSelect.value as PersonaRole)
    roleSelect.value = getStoredPersonaRole()
    refreshQcpControls()
  }

  roleWrapper.append(roleLabel, roleSelect)
  panel.appendChild(roleWrapper)

  const qcpControls = document.createElement('div')
  qcpControls.style.display = 'flex'
  qcpControls.style.gap = '8px'

  const startQcpBtn = document.createElement('button')
  startQcpBtn.textContent = 'Start QCP Hunter'
  applyButtonStyle(startQcpBtn)
  startQcpBtn.onclick = () => {
    if (roleSelect.value === 'Coordinator') {
      (window as any).qcpOrchestrator?.start()
    }
  }

  const stopQcpBtn = document.createElement('button')
  stopQcpBtn.textContent = 'Stop QCP Hunter'
  applyButtonStyle(stopQcpBtn, '#374151')
  stopQcpBtn.onclick = () => {
    if (roleSelect.value === 'Coordinator') {
      (window as any).qcpOrchestrator?.stop()
    }
  }

  qcpControls.append(startQcpBtn, stopQcpBtn)
  panel.appendChild(qcpControls)

  const queueLabel = document.createElement('div')
  queueLabel.id = 'auto-send-queue-label'
  queueLabel.textContent = 'Queue: 0'
  panel.appendChild(queueLabel)

  const btnRow = document.createElement('div')
  btnRow.style.display = 'flex'
  btnRow.style.gap = '8px'

  const clearBtn = document.createElement('button')
  clearBtn.textContent = 'Clear'
  applyButtonStyle(clearBtn, '#374151')
  clearBtn.onclick = () => {
    clearQueue()
    updateQueueLabel()
  }

  const processBtn = document.createElement('button')
  processBtn.textContent = 'Process now'
  applyButtonStyle(processBtn)
  processBtn.onclick = () => {
    processQueueManually()
  }

  btnRow.append(clearBtn, processBtn)
  panel.appendChild(btnRow)

  document.body.appendChild(panel)

  syncUIFromConfig()
  updateQueueLabel()
  const labelInterval = window.setInterval(updateQueueLabel, 800)

  panel.addEventListener('remove', () => {
    window.clearInterval(labelInterval)
  })

  window.addEventListener('beforeunload', () => {
    window.clearInterval(labelInterval)
  })

  function syncDelayInputs(minInput: HTMLInputElement, maxInput: HTMLInputElement) {
    const min = Number(minInput.value)
    const max = Number(maxInput.value)
    setDelayRange(Number.isFinite(min) ? min : 0, Number.isFinite(max) ? max : 0)
  }

  function syncUIFromConfig() {
    const current = getPluginConfig()
    autoSendCheckbox.checked = current.autoSendEnabled
    autoForwardCheckbox.checked = current.autoForwardReply

    minDelayInput.input.value = String(current.minDelayMs)
    maxDelayInput.input.value = String(current.maxDelayMs)
    retryInput.input.value = String(current.maxRetries)

    personaInput.value = getPersonaId()
    roleSelect.value = getStoredPersonaRole()
    refreshQcpControls()
  }

  function updateQueueLabel() {
    queueLabel.textContent = `Queue: ${getQueueSnapshot().length}`
  }

  function refreshQcpControls() {
    qcpControls.style.display = roleSelect.value === 'Coordinator' ? 'flex' : 'none'
  }
}

function createNumberInput(id: string, labelText: string) {
  const wrapper = document.createElement('div')
  wrapper.style.display = 'flex'
  wrapper.style.flexDirection = 'column'
  wrapper.style.gap = '4px'

  const label = document.createElement('label')
  label.textContent = labelText
  label.style.fontSize = '11px'
  label.htmlFor = id

  const input = document.createElement('input')
  input.type = 'number'
  input.id = id
  input.style.width = '100%'
  input.style.padding = '6px'
  input.style.borderRadius = '6px'
  input.style.border = '1px solid #374151'
  input.style.background = '#111827'
  input.style.color = '#f9fafb'

  wrapper.append(label, input)
  return { input, wrapper }
}

function applyButtonStyle(btn: HTMLButtonElement, background = '#10a37f') {
  btn.style.width = '100%'
  btn.style.padding = '6px 10px'
  btn.style.border = 'none'
  btn.style.borderRadius = '6px'
  btn.style.background = background
  btn.style.color = '#fff'
  btn.style.cursor = 'pointer'
  btn.style.fontSize = '12px'
}
