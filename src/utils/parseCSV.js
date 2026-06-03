import { COL } from '../constants'

// Parse ClickUp's exported date format — manually to avoid browser inconsistency
// "Thursday, April 30th 2026, 8:27:23 am +05:30"
const MONTHS = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12
}

function parseClickUpDate(str) {
  if (!str) return null
  try {
    // Strip ordinal suffixes and timezone
    const clean = str
      .replace(/(\d+)(st|nd|rd|th)/gi, '$1')
      .replace(/\s+[+-]\d{2}:\d{2}$/, '')
      .trim()
    // Format after stripping: "Thursday, April 30 2026, 8:27:23 am"
    // Extract parts
    const m = clean.match(/(\w+),\s+(\w+)\s+(\d+)\s+(\d+),\s+(\d+):(\d+):(\d+)\s+(am|pm)/i)
    if (!m) return null
    const [, , monthStr, day, year, hStr, min, sec, ampm] = m
    const month = MONTHS[monthStr.toLowerCase()]
    if (!month) return null
    let hour = parseInt(hStr, 10)
    if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12
    if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0
    return new Date(parseInt(year), month - 1, parseInt(day), hour, parseInt(min), parseInt(sec))
  } catch {
    return null
  }
}

// Handle duplicate column names by appending _1, _2 etc
function extractHeaders(rawHeaders) {
  const seen = {}
  return rawHeaders.map(h => {
    if (seen[h] !== undefined) {
      seen[h]++
      return `${h}_${seen[h]}`
    }
    seen[h] = 0
    return h
  })
}

// Strip ClickUp's bracket wrapping from user fields e.g. "[Natwar Singh Rathore]" → "Natwar Singh Rathore"
function stripBrackets(val) {
  if (!val) return ''
  return val.replace(/^\[/, '').replace(/\]$/, '').trim()
}

export function parseCSV(text) {
  const allRows = parseCSVFull(text)
  if (allRows.length < 2) throw new Error('CSV appears empty')

  const rawHeaders = allRows[0]
  const headers = extractHeaders(rawHeaders)

  const idx = {}
  headers.forEach((h, i) => { idx[h] = i })

  // Validate required columns are present
  const required = [COL.taskId, COL.taskName, COL.clientTransitioned]
  for (const col of required) {
    if (idx[col] === undefined) {
      throw new Error(`Required column "${col}" not found in CSV. Make sure you're exporting from the EM space with all custom fields.`)
    }
  }

  // Two "Primary Designer (users)" columns exist — take the second (single-user field ec7f59f4)
  const designerCol = idx['Primary Designer (users)_1'] !== undefined
    ? 'Primary Designer (users)_1'
    : COL.primaryDesigner

  const rows = []
  for (let i = 1; i < allRows.length; i++) {
    const cells = allRows[i]
    if (cells.length < 5) continue

    // Use ?? '' to correctly handle column index 0
    const get = (col) => {
      const colIdx = idx[col]
      if (colIdx === undefined) return ''
      return (cells[colIdx] ?? '').trim()
    }

    // Only include rows with a valid ClickUp task ID
    const taskId = get(COL.taskId)
    if (!taskId || taskId.length < 5) continue

    rows.push({
      taskId,
      taskName:    get(COL.taskName),
      status:      get(COL.status),
      list:        get(COL.list),
      dateCreated: parseClickUpDate(get(COL.dateCreated)),
      client:      get(COL.clientTransitioned),
      brand:       get(COL.brandEmail),
      taskSource:  get(COL.taskSource),
      billingMonth:get(COL.billingMonth),
      reqMonth:    get(COL.reqReceivedMonth),
      deliverables:get(COL.deliverablesEM),
      designer:    stripBrackets(get(designerCol) || get(COL.primaryDesigner)),
      developer:   stripBrackets(get(COL.primaryDeveloper)),
    })
  }

  return rows
}

// Full RFC 4180 CSV parser — handles embedded newlines and quotes correctly
function parseCSVFull(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        field += ch
        i++
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
      } else if (ch === ',') {
        row.push(field)
        field = ''
        i++
      } else if (ch === '\r' && text[i + 1] === '\n') {
        row.push(field)
        field = ''
        rows.push(row)
        row = []
        i += 2
      } else if (ch === '\n') {
        row.push(field)
        field = ''
        rows.push(row)
        row = []
        i++
      } else {
        field += ch
        i++
      }
    }
  }

  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}
