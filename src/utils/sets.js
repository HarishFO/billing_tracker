function getBillingMonthRange(billingMonth) {
  const months = {
    'January':1,'February':2,'March':3,'April':4,'May':5,'June':6,
    'July':7,'August':8,'September':9,'October':10,'November':11,'december':12
  }
  const [monthName, yearStr] = billingMonth.split(' ')
  const month = months[monthName] || months[monthName?.toLowerCase()]
  const year  = parseInt(yearStr, 10)
  if (!month || !year) return [0, Infinity]

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear  = month === 1 ? year - 1 : year
  const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate()
  const start = new Date(prevYear, prevMonth - 1, daysInPrevMonth - 1, 0, 0, 0).getTime()
  const end   = new Date(year, month, 0, 23, 59, 59, 999).getTime()

  return [start, end]
}

export function computeSets(rows, clientList, billingMonth) {
  const clientSet = new Set(clientList.map(c => c.toLowerCase().trim()))
  const isTransitionedClient = (val) =>
    val && clientSet.has(val.toLowerCase().trim())

  const [start, end] = getBillingMonthRange(billingMonth)
  const createdInRange = (r) => {
    if (!r.dateCreated) return false
    const ts = r.dateCreated.getTime()
    return ts >= start && ts <= end
  }

  // A task deliberately assigned to a DIFFERENT billing month — don't disturb
  const isAssignedElsewhere = (r) =>
    (r.billingMonth && r.billingMonth !== billingMonth) ||
    (r.reqMonth && r.reqMonth !== billingMonth)

  // Set B — Task Source = Transitioned + created in window + not billed elsewhere
  const B = rows.filter(r =>
    r.taskSource === 'Transitioned' &&
    createdInRange(r) &&
    !isAssignedElsewhere(r)
  )

  // Set C — Billing Month OR Req Month = billing month (explicit tagging)
  const C = rows.filter(r =>
    r.billingMonth === billingMonth || r.reqMonth === billingMonth
  )

  // Set D — ground truth = UNION of B and C
  // Everything that is either source-tagged for this period OR explicitly month-tagged
  const bIds = new Set(B.map(r => r.taskId))
  const cIds = new Set(C.map(r => r.taskId))
  const allIds = new Set([...bIds, ...cIds])
  const rowMap = new Map(rows.map(r => [r.taskId, r]))
  const D = [...allIds].map(id => rowMap.get(id)).filter(Boolean)

  // Set A — core billing: all three fields correctly set
  const A = rows.filter(r =>
    r.taskSource === 'Transitioned' &&
    r.billingMonth === billingMonth &&
    r.reqMonth === billingMonth
  )

  return { D, A, B, C }
}

export function computeGaps(sets, billingMonth) {
  const aIds = new Set(sets.A.map(r => r.taskId))
  const bIds = new Set(sets.B.map(r => r.taskId))
  const cIds = new Set(sets.C.map(r => r.taskId))

  return sets.D
    .filter(r => !aIds.has(r.taskId))
    .map(r => {
      const missing = []
      if (r.taskSource !== 'Transitioned') missing.push('Task Source')
      if (r.billingMonth !== billingMonth)  missing.push('Billing Month')
      if (r.reqMonth !== billingMonth)      missing.push('Req Received Month')

      return {
        taskId:   r.taskId,
        taskName: r.taskName,
        client:   r.client,
        brand:    r.brand,
        status:   r.status,
        list:     r.list,
        missing,
        inB: bIds.has(r.taskId),
        inC: cIds.has(r.taskId),
      }
    })
}

export function reconciliationStatus(sets) {
  const counts = { D: sets.D.length, A: sets.A.length, B: sets.B.length, C: sets.C.length }
  const allEqual = counts.D === counts.A && counts.A === counts.B && counts.B === counts.C
  return { counts, allEqual }
}

export function orphanedSourceTasks(rows, clientList) {
  const clientSet = new Set(clientList.map(c => c.toLowerCase().trim()))
  return rows.filter(r =>
    r.taskSource === 'Transitioned' &&
    (!r.client || !clientSet.has(r.client.toLowerCase().trim()))
  )
}

export function unknownClientTasks(rows, clientList) {
  const clientSet = new Set(clientList.map(c => c.toLowerCase().trim()))
  return rows.filter(r =>
    r.client && !clientSet.has(r.client.toLowerCase().trim())
  )
}

// Check Set A tasks for missing required fields
export function dataQualityIssues(tasks) {
  const REQUIRED = [
    { key: 'client',       label: 'Client (transitioned)' },
    { key: 'brand',        label: 'Brand email (transitioned)' },
    { key: 'billingMonth', label: 'Billing Month' },
    { key: 'reqMonth',     label: 'Req Received Month' },
    { key: 'deliverables', label: 'Deliverables EM' },
    { key: 'designer',     label: 'Primary Designer' },
    { key: 'developer',    label: 'Primary Developer' },
  ]

  return tasks
    .map(r => {
      const deliv = (r.deliverables || '').toLowerCase().trim()
      const hasDesign = deliv.includes('design')
      const hasDev    = deliv.includes('dev')
      const delivSet  = deliv.length > 0 // deliverable field is filled

      const missing = REQUIRED
        .filter(f => {
          // Only flag designer if deliverable includes Design
          if (f.key === 'designer') {
            if (!delivSet) return false // can't judge without knowing deliverable
            return hasDesign && (!r[f.key] || r[f.key].trim() === '')
          }
          // Only flag developer if deliverable includes Dev
          if (f.key === 'developer') {
            if (!delivSet) return false
            return hasDev && (!r[f.key] || r[f.key].trim() === '')
          }
          return !r[f.key] || r[f.key].trim() === ''
        })
        .map(f => f.label)
      return missing.length > 0 ? { ...r, missingFields: missing } : null
    })
    .filter(Boolean)
}
