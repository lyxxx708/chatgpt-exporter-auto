import { getInstanceId } from '../agent/identity'
import type { PersonaRole, PersonaRoleWorker } from './types'

export const QCP_PERSONA_KEY = 'qcp_persona'
const ROLE_CHANGED_EVENT = 'qcp-persona-changed'

export function getStoredPersonaRole(): PersonaRole {
  const value = localStorage.getItem(QCP_PERSONA_KEY)
  if (value === null) return 'None'

  const allowed: PersonaRole[] = ['None', 'Coordinator', 'Maximizer', 'Minimizer', 'Synthesizer', 'Judge']
  return allowed.includes(value as PersonaRole) ? (value as PersonaRole) : 'None'
}

export function setStoredPersonaRole(role: PersonaRole) {
  localStorage.setItem(QCP_PERSONA_KEY, role)
  const evt = new CustomEvent<PersonaRole>(ROLE_CHANGED_EVENT, { detail: role })
  window.dispatchEvent(evt)
}

export function onPersonaRoleChange(handler: (role: PersonaRole) => void) {
  window.addEventListener(ROLE_CHANGED_EVENT, (event) => {
    const detailRole = (event as CustomEvent<PersonaRole>).detail
    handler(detailRole)
  })
}

export function isWorkerRole(role: PersonaRole): role is PersonaRoleWorker {
  return role !== 'None' && role !== 'Coordinator'
}

export function getQcpTabId(): string {
  return getInstanceId()
}
