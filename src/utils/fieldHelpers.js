import { FIELD, TRANSITIONED_FRAGMENTS } from '../constants'

// ── Extract a custom field value by ID ────────────────────────────────────────
export function getField(task, fieldId) {
  const cf = (task.custom_fields || []).find(f => f.id === fieldId)
  if (!cf || cf.value === null || cf.value === undefined) return null

  if (cf.type === 'drop_down') {
    const opts = cf.type_config?.options ?? []
    // ClickUp returns numeric index or option id
    const idx = typeof cf.value === 'number' ? cf.value : null
    if (idx !== null && opts[idx]) return opts[idx].name
    const opt = opts.find(o => o.id === cf.value || o.name === cf.value)
    return opt ? opt.name : String(cf.value)
  }

  if (cf.type === 'users') {
    const users = Array.isArray(cf.value) ? cf.value : []
    return users.map(u => u.username || u.email || '').filter(Boolean).join(', ')
  }

  return String(cf.value)
}

// ── Convenience getters ───────────────────────────────────────────────────────
export const getTaskSource         = t => getField(t, FIELD.taskSource)
export const getBillingMonth       = t => getField(t, FIELD.billingMonth)
export const getReqReceivedMonth   = t => getField(t, FIELD.reqReceivedMonth)
export const getClientTransitioned = t => getField(t, FIELD.clientTransitioned)
export const getBrandEmail         = t => getField(t, FIELD.brandEmail)
export const getDeliverablesEM     = t => getField(t, FIELD.deliverablesEM)
export const getPrimaryDesigner    = t => getField(t, FIELD.primaryDesigner)
export const getPrimaryDeveloper   = t => getField(t, FIELD.primaryDeveloper)

// ── Transitioned client match ─────────────────────────────────────────────────
export function isTransitionedClient(clientValue) {
  if (!clientValue) return false
  const lower = clientValue.toLowerCase().trim()
  return TRANSITIONED_FRAGMENTS.some(frag => lower.includes(frag) || frag.includes(lower))
}

// ── Month range helpers ───────────────────────────────────────────────────────
export function getMonthRange(monthStr) {
  // monthStr = "May 2026"
  const d = new Date(`${monthStr} 1`)
  const start = d.getTime()
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
  return { start, end }
}

export function createdInRange(task, range) {
  const ts = parseInt(task.date_created, 10)
  return ts >= range.start && ts < range.end
}

export function formatCreatedDate(task) {
  const ts = parseInt(task.date_created, 10)
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleString('en-US', { month: 'long', day: 'numeric' })
}

// ── Dedup by task ID — keep version from furthest-along list ─────────────────
// tasksByList: array of { listId, tasks[] }
export function deduplicateTasks(tasksByList) {
  const seen = new Map() // id → { task, priority }

  for (const { listId, tasks } of tasksByList) {
    const priority = LIST_PRIORITY[listId] ?? -1
    for (const task of tasks) {
      const existing = seen.get(task.id)
      if (!existing || priority > existing.priority) {
        seen.set(task.id, { task: { ...task, _listId: listId }, priority })
      }
    }
  }

  return Array.from(seen.values()).map(v => v.task)
}

// ── Map task → tracker row ────────────────────────────────────────────────────
export function toTrackerRow(task) {
  return {
    id:              task.id,
    url:             task.url,
    date:            formatCreatedDate(task),
    client:          getClientTransitioned(task) || '',
    brand:           getBrandEmail(task) || '',
    taskName:        task.name || '',
    deliverables:    getDeliverablesEM(task) || '',
    billingMonth:    getBillingMonth(task) || '',
    reqMonth:        getReqReceivedMonth(task) || '',
    taskSource:      getTaskSource(task) || '',
    designer:        getPrimaryDesigner(task) || '',
    developer:       getPrimaryDeveloper(task) || '',
    status:          task.status?.status || '',
    list:            task.list?.name || '',
  }
}
