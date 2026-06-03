const FIELD_ID_CLIENTS = 'cc80f6eb-dd7c-4f42-b240-175ab0d07e13'
const SPACE_ID = '90165413223'

// Use proxy path on deployed environments, direct URL on localhost
function clickupUrl(path) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const base = isLocal ? 'https://api.clickup.com' : '/api/clickup'
  return `${base}${path}`
}

export async function fetchTransitionedClients(token) {
  const url = clickupUrl(`/api/v2/space/${SPACE_ID}/field`)
  const res = await fetch(url, {
    headers: { Authorization: token }
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.err || `ClickUp API error: ${res.status}`)
  }

  const data = await res.json()
  const field = data.fields?.find(f => f.id === FIELD_ID_CLIENTS)
  if (!field) throw new Error('Clients (transitioned) field not found in space')

  return field.type_config?.options?.map(o => o.name) || []
}
