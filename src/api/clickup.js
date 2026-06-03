import { EM_SPACE_ID, FIELD_IDS } from '../constants'

const BASE = 'https://api.clickup.com/api/v2'

async function cuFetch(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: token, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`ClickUp API ${res.status}: ${text}`)
  }
  return res.json()
}

// Validate token and return user info
export async function validateToken(token) {
  const data = await cuFetch('/user', token)
  return { valid: true, user: data.user }
}

// Fetch all options from the Clients (transitioned) dropdown
// Returns string[] of exact client names — this is the master list
export async function fetchTransitionedClients(token) {
  const data = await cuFetch(`/space/${EM_SPACE_ID}/field`, token)
  const field = data.fields?.find(f => f.id === FIELD_IDS.clientTransitioned)
  if (!field) throw new Error('Clients (transitioned) field not found in EM space')
  return field.type_config.options.map(o => o.name)
}
