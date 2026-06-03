import { toTrackerRow } from './fieldHelpers'

const HEADERS = [
  'Date',
  'Clients (transitioned)',
  'Brands email (transitioned)',
  'Task Name',
  'Deliverables EM',
  'Billing Month',
  'Req Received Month',
  'Primary Designer',
  'Primary Developer',
  'Task Source',
  'Status',
  'List',
  'Task URL',
]

const KEYS = [
  'date', 'client', 'brand', 'taskName', 'deliverables',
  'billingMonth', 'reqMonth', 'designer', 'developer',
  'taskSource', 'status', 'list', 'url',
]

function tasksToRows(tasks) {
  return tasks
    .map(toTrackerRow)
    .sort((a, b) => {
      // sort by date then client
      if (a.date < b.date) return -1
      if (a.date > b.date) return 1
      return a.client.localeCompare(b.client)
    })
}

// ── CSV (single set) ──────────────────────────────────────────────────────────
export function downloadCSV(tasks, filename) {
  const rows = tasksToRows(tasks)
  const lines = [
    HEADERS.join(','),
    ...rows.map(r =>
      KEYS.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ]
  triggerDownload(lines.join('\n'), filename, 'text/csv')
}

// ── XLSX (3 tabs: Set A master, Set B, Set C) ─────────────────────────────────
export async function downloadXLSX(sets, monthStr) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const sheetDefs = [
    { label: 'Set A — Master',  tasks: sets.A },
    { label: 'Set B',           tasks: sets.B },
    { label: 'Set C — Umbrella', tasks: sets.C },
  ]

  for (const { label, tasks } of sheetDefs) {
    const rows = tasksToRows(tasks)
    const data = [
      HEADERS,
      ...rows.map(r => KEYS.map(k => r[k] ?? '')),
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)

    // column widths
    ws['!cols'] = [
      { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 50 },
      { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 22 },
      { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 40 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, label)
  }

  const filename = `${monthStr.replace(' ', '_')}_EM_Billing_Tracker.xlsx`
  XLSX.writeFile(wb, filename)
}

// ── Trigger browser download ──────────────────────────────────────────────────
function triggerDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
