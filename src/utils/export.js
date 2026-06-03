import { TRACKER_COLS } from '../constants'

function toTrackerRow(r) {
  let date = ''
  if (r.dateCreated) {
    date = r.dateCreated.toLocaleString('en-US', { month: 'long', day: 'numeric' })
  }
  return {
    date,
    client:       r.client || '',
    brand:        r.brand || '',
    taskName:     r.taskName || '',
    deliverables: r.deliverables || '',
    billingMonth: r.billingMonth || '',
    designer:     r.designer || '',
    developer:    r.developer || '',
    taskId:       r.taskId || '',
    status:       r.status || '',
    list:         r.list || '',
    _isManual:    r._isManual || false,
    _dateTs:      r.dateCreated ? r.dateCreated.getTime() : (r._isManual ? Infinity : 0),
  }
}

function sortTrackerRows(rows) {
  return [...rows].sort((a, b) => {
    const ta = a._dateTs ?? 0
    const tb = b._dateTs ?? 0
    if (ta !== tb) return ta - tb
    return (a.client || '').localeCompare(b.client || '')
  })
}

// Sanitise Excel sheet name — max 31 chars, no special chars
function toSheetName(name, usedNames) {
  let clean = name
    .replace(/[\[\]\/\\?*:]/g, '')
    .trim()
    .slice(0, 31)
  if (!clean) clean = 'Unknown'
  // Handle collisions from truncation
  let candidate = clean
  let i = 2
  while (usedNames.has(candidate)) {
    const suffix = `_${i++}`
    candidate = clean.slice(0, 31 - suffix.length) + suffix
  }
  usedNames.add(candidate)
  return candidate
}

export async function exportXLSX(sets, manualRows, billingMonth) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const headers = [...TRACKER_COLS.map(c => c.label), 'Status', 'List', 'Task ID']
  const keys    = [...TRACKER_COLS.map(c => c.key),   'status', 'list', 'taskId']
  const colWidths = [
    { wch: 12 }, { wch: 24 }, { wch: 24 }, { wch: 55 },
    { wch: 30 }, { wch: 14 }, { wch: 22 }, { wch: 22 },
    { wch: 16 }, { wch: 18 }, { wch: 14 },
  ]

  const usedNames = new Set()

  function appendSheet(rawName, tasks) {
    const sheetName = toSheetName(rawName, usedNames)
    const rows = sortTrackerRows(tasks.map(toTrackerRow))
    const data = [headers, ...rows.map(r => keys.map(k => r[k] ?? ''))]
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = colWidths
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  // Fixed sheets
  const allSetA = [...sets.A, ...manualRows]
  appendSheet('Master (Set A)', allSetA)
  appendSheet('Set B', sets.B)
  appendSheet('Set C', sets.C)

  // Per-client sheets from Set A — sorted alphabetically
  const byClient = {}
  for (const task of allSetA) {
    const client = task.client || '— No Client'
    if (!byClient[client]) byClient[client] = []
    byClient[client].push(task)
  }

  const clientNames = Object.keys(byClient).sort((a, b) => a.localeCompare(b))
  for (const client of clientNames) {
    appendSheet(client, byClient[client])
  }

  XLSX.writeFile(wb, `${billingMonth.replace(' ', '_')}_EM_Billing_Tracker.xlsx`)
}

export function exportSetCSV(tasks, setName, billingMonth) {
  const rows = sortTrackerRows(tasks.map(toTrackerRow))
  const headers = [...TRACKER_COLS.map(c => c.label), 'Status', 'List', 'Task ID']
  const keys    = [...TRACKER_COLS.map(c => c.key),   'status', 'list', 'taskId']

  const lines = [
    headers.join(','),
    ...rows.map(r => keys.map(k =>
      `"${String(r[k] ?? '').replace(/"/g, '""')}"`
    ).join(',')),
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${billingMonth.replace(' ', '_')}_Set${setName}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
