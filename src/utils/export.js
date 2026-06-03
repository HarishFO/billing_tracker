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

function toSheetName(name, usedNames) {
  let clean = name.replace(/[\[\]\/\\?*:]/g, '').trim().slice(0, 31)
  if (!clean) clean = 'Unknown'
  let candidate = clean
  let i = 2
  while (usedNames.has(candidate)) {
    const suffix = `_${i++}`
    candidate = clean.slice(0, 31 - suffix.length) + suffix
  }
  usedNames.add(candidate)
  return candidate
}

// Column headers and keys — no Status or List
const HEADERS = TRACKER_COLS.map(c => c.label)
const KEYS    = TRACKER_COLS.map(c => c.key)
const COL_WIDTHS = [
  { wch: 12 }, { wch: 26 }, { wch: 26 }, { wch: 55 },
  { wch: 30 }, { wch: 14 }, { wch: 22 }, { wch: 22 },
]

function buildCoverSheet(XLSX, billingMonth, allSetA, clientList) {
  const ws = {}
  let row = 1

  // Helper to write a cell
  const cell = (c, r, v, style) => {
    const ref = `${c}${r}`
    ws[ref] = { v, t: typeof v === 'number' ? 'n' : 's', ...style }
  }

  // Title block
  cell('A', row, 'Optimite')
  cell('A', row + 1, `${billingMonth} — EM Billing Tracker`)
  cell('A', row + 2, `Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`)
  row += 4

  // Summary stats
  const totalTasks   = allSetA.length
  const totalClients = new Set(allSetA.map(r => r.client).filter(Boolean)).size
  const totalBrands  = new Set(allSetA.map(r => r.brand).filter(Boolean)).size

  cell('A', row, 'Total Tasks (Set A)')
  cell('B', row, totalTasks)
  row++
  cell('A', row, 'Total Clients')
  cell('B', row, totalClients)
  row++
  cell('A', row, 'Total Brands')
  cell('B', row, totalBrands)
  row += 2

  // Client analytics table header
  cell('A', row, 'Client')
  cell('B', row, 'Tasks')
  cell('C', row, '% of Total')
  row++

  // Group Set A by client, sorted descending by task count
  const byClient = {}
  for (const task of allSetA) {
    const c = task.client || '— No Client'
    byClient[c] = (byClient[c] || 0) + 1
  }

  // All transitioned clients from live list — show 0 for those with no tasks
  const allClients = new Set([
    ...Object.keys(byClient),
    ...(clientList || []),
  ])

  const sorted = [...allClients]
    .map(c => ({ client: c, count: byClient[c] || 0 }))
    .sort((a, b) => b.count - a.count)

  for (const { client, count } of sorted) {
    const pct = totalTasks > 0 ? ((count / totalTasks) * 100).toFixed(1) + '%' : '0%'
    cell('A', row, client)
    cell('B', row, count)
    cell('C', row, pct)
    row++
  }

  // Set sheet ref range
  ws['!ref'] = `A1:C${row}`
  ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }]

  return ws
}

export async function exportXLSX(sets, manualRows, billingMonth, clientList) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const allSetA = [...sets.A, ...manualRows]
  const usedNames = new Set()

  // Sheet 1 — Cover page
  const coverSheet = buildCoverSheet(XLSX, billingMonth, allSetA, clientList)
  const coverName = toSheetName(`${billingMonth} Overview`, usedNames)
  XLSX.utils.book_append_sheet(wb, coverSheet, coverName)

  function appendSheet(rawName, tasks) {
    const sheetName = toSheetName(rawName, usedNames)
    const rows = sortTrackerRows(tasks.map(toTrackerRow))
    const data = [HEADERS, ...rows.map(r => KEYS.map(k => r[k] ?? ''))]
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = COL_WIDTHS
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  // Core sheets
  appendSheet('Master (Set A)', allSetA)
  appendSheet('Set B', sets.B)
  appendSheet('Set C', sets.C)

  // Per-client sheets from Set A
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
  const lines = [
    HEADERS.join(','),
    ...rows.map(r => KEYS.map(k =>
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
