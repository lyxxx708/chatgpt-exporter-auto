// === v6.2: 窗口与 persona 标识 ===

let cachedInstanceId: string | null = null
let cachedPersonaId: string | null = null

export function getInstanceId(): string {
  if (cachedInstanceId) return cachedInstanceId
  const key = 'auto-agent-instance-id'
  const existing = sessionStorage.getItem(key)
  if (existing) {
    cachedInstanceId = existing
    return existing
  }
  const id = 'inst_' + Math.random().toString(16).slice(2)
  sessionStorage.setItem(key, id)
  cachedInstanceId = id
  return id
}

export function getPersonaId(): string {
  if (cachedPersonaId) return cachedPersonaId

  const url = new URL(window.location.href)
  const fromQuery = url.searchParams.get('persona')
  if (fromQuery) {
    cachedPersonaId = fromQuery
    return fromQuery
  }

  const key = 'auto-agent-persona-id'
  const fromStorage = localStorage.getItem(key)
  if (fromStorage) {
    cachedPersonaId = fromStorage
    return fromStorage
  }

  cachedPersonaId = 'default'
  return 'default'
}

export function setPersonaId(personaId: string) {
  const key = 'auto-agent-persona-id'
  cachedPersonaId = personaId
  localStorage.setItem(key, personaId)
}
