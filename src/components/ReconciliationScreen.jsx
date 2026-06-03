import { useState, useMemo, useCallback } from 'react'
import { DQFixRow, BulkFixPanel } from './DQFixButton'
import { computeGaps, reconciliationStatus, orphanedSourceTasks, unknownClientTasks, dataQualityIssues } from '../utils/sets'
import { BILLING_MONTHS } from '../constants'

// ClickUp field/option IDs for May 2026
// These are fetched live; for now baked in as the app always targets current billing month
// Field IDs are stable. Option IDs for "May 2026" are the ones confirmed from the space.
const FIELD_IDS = {
  taskSource:  '285f4d84-37be-47db-be4a-45b9eb978f83',
  billingMonth:'5e4917cb-4a24-4222-a526-3ecdcb881ebb',
  reqMonth:    'c629bf84-1f1f-47cb-b8bb-efe8fec3da98',
}

// Dropdown option IDs per billing month
const MONTH_OPTION_IDS = {
  'May 2026': {
    billingMonth: '2ca3183e-a6f1-4bbd-8e44-c06d75aa7581',
    reqMonth:     'b6249e3c-36b5-4f2f-8743-df1295e1a9e0',
  },
  'April 2026': {
    billingMonth: '8d8b8e07-7d4a-443f-ae7e-c8b2326ef053',
    reqMonth:     '698c5433-b62d-482b-98f6-4e7067fdf287',
  },
  'March 2026': {
    billingMonth: '1136d454-2cec-433e-ac91-d4e93a95bc52',
    reqMonth:     'be8f4e84-1dbc-48fe-be48-67dcec01e33f',
  },
  'February 2026': {
    billingMonth: 'd0b089cf-b180-4791-ad49-c44787354d13',
    reqMonth:     'cb2b55b3-4c49-4139-8a29-217bf619923a',
  },
  'January 2026': {
    billingMonth: '8eff9d77-0c47-4f57-a2a3-fd0911ef8038',
    reqMonth:     'ac0dc75c-a4f3-484b-a025-b9c50c536d84',
  },
}

const TRANSITIONED_OPTION_ID = '7fb18253-2c3c-4d5f-ae52-0e1807b33cb2'

async function fixTaskInClickUp(taskId, missing, billingMonth, apiToken) {
  const monthOpts = MONTH_OPTION_IDS[billingMonth]
  if (!monthOpts) throw new Error(`No option IDs mapped for billing month: ${billingMonth}`)

  const customFields = []
  if (missing.includes('Task Source')) {
    customFields.push({ id: FIELD_IDS.taskSource, value: TRANSITIONED_OPTION_ID })
  }
  if (missing.includes('Billing Month')) {
    customFields.push({ id: FIELD_IDS.billingMonth, value: monthOpts.billingMonth })
  }
  if (missing.includes('Req Received Month')) {
    customFields.push({ id: FIELD_IDS.reqMonth, value: monthOpts.reqMonth })
  }

  if (customFields.length === 0) return

  // ClickUp API: set each custom field individually
  for (const field of customFields) {
    const res = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/field/${field.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiToken,
      },
      body: JSON.stringify({ value: field.value }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.err || `HTTP ${res.status}`)
    }
  }
}

function FixButton({ taskId, missing, billingMonth, apiToken, onFixed }) {
  const [state, setState] = useState('idle') // idle | fixing | fixed | error
  const [errMsg, setErrMsg] = useState('')

  async function handleFix() {
    if (!apiToken) { alert('No API token — re-enter token on the upload screen'); return }
    setState('fixing')
    try {
      await fixTaskInClickUp(taskId, missing, billingMonth, apiToken)
      setState('fixed')
      onFixed && onFixed(taskId)
    } catch (e) {
      setState('error')
      setErrMsg(e.message)
    }
  }

  if (state === 'fixed') return <span className="fix-btn fixed">✓ Fixed</span>
  if (state === 'error') return <span className="fix-btn error" title={errMsg}>✗ {errMsg.slice(0,30)}</span>
  return (
    <button
      className={`fix-btn ${state === 'fixing' ? 'fixing' : ''}`}
      onClick={handleFix}
      disabled={state === 'fixing'}
    >
      {state === 'fixing' ? '⟳ Fixing…' : '⚡ Fix'}
    </button>
  )
}

export default function ReconciliationScreen({
  rows, sets, clientList, billingMonth, setBillingMonth, onProceed, onReupload, apiToken
}) {
  const [override, setOverride]       = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [fixedIds, setFixedIds]       = useState(new Set())
  const [fixingAll, setFixingAll]     = useState(false)
  const [selectedDQ, setSelectedDQ]   = useState(new Set())
  const [fixAllProgress, setFixAllProgress] = useState({ done: 0, total: 0 })

  const { counts, allEqual } = useMemo(() => reconciliationStatus(sets), [sets])
  const gaps     = useMemo(() => computeGaps(sets, billingMonth), [sets, billingMonth])
  const orphaned = useMemo(() => orphanedSourceTasks(rows, clientList), [rows, clientList])
  const unknown  = useMemo(() => unknownClientTasks(rows, clientList), [rows, clientList])
  const dqIssues = useMemo(() => dataQualityIssues(sets.A),              [sets.A])

  const unfixedGaps = gaps.filter(g => !fixedIds.has(g.taskId))
  const canProceed = (allEqual || fixedIds.size >= gaps.length || (override && overrideReason.trim().length > 0))

  const handleFixed = useCallback((id) => {
    setFixedIds(prev => new Set([...prev, id]))
  }, [])

  async function fixAll() {
    if (!apiToken) { alert('No API token — re-enter on upload screen'); return }
    const toFix = unfixedGaps
    setFixingAll(true)
    setFixAllProgress({ done: 0, total: toFix.length })
    for (let i = 0; i < toFix.length; i++) {
      const g = toFix[i]
      try {
        await fixTaskInClickUp(g.taskId, g.missing, billingMonth, apiToken)
        handleFixed(g.taskId)
      } catch (_) {}
      setFixAllProgress({ done: i + 1, total: toFix.length })
    }
    setFixingAll(false)
  }

  const logo = '/mnt/skills/organization/optimite-brand-guidelines/assets/optimite-logo-white.webp'

  return (
    <div className="recon-screen">
      <div className="screen-header">
        <div>
<h2>Reconciliation — {billingMonth}</h2>
          <div className="header-meta">{rows.length} total tasks in CSV · {counts.D} transitioned client tasks</div>
        </div>
        <div className="header-actions">
          <select className="month-select" value={billingMonth} onChange={e => setBillingMonth(e.target.value)}>
            {BILLING_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button className="btn-ghost" onClick={onReupload}>Re-upload CSV</button>
        </div>
      </div>

      {/* Set count cards */}
      <div className="set-cards">
        {[
          { key:'D', label:'Set D', sub:'Ground Truth',  color:'purple', desc:'Union of B & C — all tasks belonging to this period (ceiling)' },
          { key:'A', label:'Set A', sub:'Core Billing',  color:'green',  desc:`Source=Transitioned AND Billing Month=${billingMonth} AND Req Month=${billingMonth} (target)` },
          { key:'B', label:'Set B', sub:'Source Tagged', color:'blue',   desc:'Task Source=Transitioned, created in billing window, not billed elsewhere' },
          { key:'C', label:'Set C', sub:'Month Tagged',  color:'amber',  desc:`Billing Month OR Req Month = ${billingMonth}` },
        ].map(s => {
          const count = counts[s.key]
          const matches = count === counts.D
          return (
            <div key={s.key} className={`set-card set-card--${s.color}`}>
              <div className="set-card-header">
                <span className="set-card-label">{s.label}</span>
                <span className="set-card-sub">{s.sub}</span>
              </div>
              <div className="set-card-count" style={{ color: `var(--${s.color})` }}>{count}</div>
              <div className="set-card-desc">{s.desc}</div>
              {s.key !== 'D' && (
                <div className={`set-card-status ${matches ? 'match' : 'gap'}`}>
                  {matches ? '✓ Matches D' : `✗ Gap of ${Math.abs(counts.D - count)}`}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Banner */}
      <div className={`recon-banner ${(allEqual || fixedIds.size >= gaps.length) ? 'recon-banner--ok' : 'recon-banner--warn'}`}>
        <span className="recon-banner-icon">{(allEqual || fixedIds.size >= gaps.length) ? '✓' : '⚠'}</span>
        <div>
          {allEqual
            ? `All 4 sets match at ${counts.D} tasks — ready to generate tracker${dqIssues.length > 0 ? ` · ${dqIssues.length} incomplete in Set A` : ''}`
            : fixedIds.size >= gaps.length && gaps.length > 0
              ? `All ${gaps.length} gap tasks fixed in ClickUp — re-export CSV to confirm, or proceed now`
              : `Gap detected — D vs A count differs by ${Math.abs(counts.D - counts.A)}, with ${unfixedGaps.length} task(s) missing required fields. Fix below or in ClickUp, then re-export.`
          }
        </div>
      </div>



      {/* Data quality — missing fields in Set A */}
      {dqIssues.length > 0 && (
        <div className="section">
          <div className="section-title warning">
            Set A — Incomplete Fields
            <span className="section-count">{dqIssues.length} tasks</span>
          </div>
          <p className="section-note">
            These tasks are in Set A but are missing required fields. Select tasks and use bulk fix, or fix individually per row.
          </p>

          <BulkFixPanel
            selectedTasks={dqIssues.filter(r => selectedDQ.has(r.taskId))}
            apiToken={apiToken}
            onBulkFixed={() => setSelectedDQ(new Set())}
          />

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{width:32}}>
                    <input type="checkbox"
                      style={{accentColor:'var(--lime)'}}
                      checked={selectedDQ.size === dqIssues.length && dqIssues.length > 0}
                      onChange={e => setSelectedDQ(e.target.checked ? new Set(dqIssues.map(r => r.taskId)) : new Set())}
                    />
                  </th>
                  <th>Task Name</th>
                  <th>Client</th>
                  <th>Missing Fields</th>
                  <th>Fix Individually</th>
                </tr>
              </thead>
              <tbody>
                {dqIssues.map(r => (
                  <tr key={r.taskId} style={selectedDQ.has(r.taskId) ? {background:'rgba(98,216,78,0.04)'} : {}}>
                    <td>
                      <input type="checkbox"
                        style={{accentColor:'var(--lime)'}}
                        checked={selectedDQ.has(r.taskId)}
                        onChange={e => {
                          setSelectedDQ(prev => {
                            const next = new Set(prev)
                            e.target.checked ? next.add(r.taskId) : next.delete(r.taskId)
                            return next
                          })
                        }}
                      />
                    </td>
                    <td>
                      <a href={`https://app.clickup.com/t/${r.taskId}`} target="_blank" rel="noreferrer" className="task-link">
                        {r.taskName}
                      </a>
                    </td>
                    <td>{r.client || <span className="na">—</span>}</td>
                    <td>{r.missingFields.map(m => <span key={m} className="missing-tag">{m}</span>)}</td>
                    <td><DQFixRow task={r} apiToken={apiToken} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Gap table */}
      {gaps.length > 0 && (
        <div className="section">
          <div className="section-title">
            Gap Tasks — in Set D but not in Set A
            <span className="section-count">{unfixedGaps.length} remaining</span>
          </div>

          {unfixedGaps.length > 1 && (
            <div className="fix-all-bar">
              <span className="fix-all-info">
                Fix all {unfixedGaps.length} tasks directly in ClickUp without leaving this page
              </span>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                {fixAllProgress.total > 0 && (
                  <span className="fix-progress">
                    {fixAllProgress.done}/{fixAllProgress.total} fixed
                  </span>
                )}
                <button className="btn-secondary" onClick={fixAll} disabled={fixingAll}>
                  {fixingAll ? `Fixing ${fixAllProgress.done}/${fixAllProgress.total}…` : `⚡ Fix All ${unfixedGaps.length}`}
                </button>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task Name</th><th>Client</th><th>Brand</th>
                  <th>Status</th><th>List</th><th>Missing Fields</th>
                  <th>In B</th><th>In C</th><th>Fix</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map(g => (
                  <tr key={g.taskId} style={fixedIds.has(g.taskId) ? { opacity: 0.4 } : {}}>
                    <td>
                      <a href={`https://app.clickup.com/t/${g.taskId}`} target="_blank" rel="noreferrer" className="task-link">
                        {g.taskName}
                      </a>
                    </td>
                    <td>{g.client}</td>
                    <td className={!g.brand ? 'na' : ''}>{g.brand || '—'}</td>
                    <td><span className="status-badge">{g.status}</span></td>
                    <td className="muted">{g.list}</td>
                    <td>{g.missing.map(m => <span key={m} className="missing-tag">{m}</span>)}</td>
                    <td className={g.inB ? 'yes' : 'no'}>{g.inB ? '✓' : '✗'}</td>
                    <td className={g.inC ? 'yes' : 'no'}>{g.inC ? '✓' : '✗'}</td>
                    <td>
                      {!fixedIds.has(g.taskId)
                        ? <FixButton taskId={g.taskId} missing={g.missing} billingMonth={billingMonth} apiToken={apiToken} onFixed={handleFixed} />
                        : <span className="fix-btn fixed">✓ Fixed</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Orphaned tasks */}
      {orphaned.length > 0 && (
        <div className="section">
          <div className="section-title warning">
            Data Quality — Source=Transitioned but no Client field
            <span className="section-count">{orphaned.length}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Task Name</th><th>Status</th><th>List</th><th>Billing Month</th></tr></thead>
              <tbody>
                {orphaned.map(r => (
                  <tr key={r.taskId}>
                    <td><a href={`https://app.clickup.com/t/${r.taskId}`} target="_blank" rel="noreferrer" className="task-link">{r.taskName}</a></td>
                    <td><span className="status-badge">{r.status}</span></td>
                    <td className="muted">{r.list}</td>
                    <td className="muted">{r.billingMonth || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unknown clients */}
      {unknown.length > 0 && (
        <div className="section">
          <div className="section-title warning">
            Unknown Clients — not in ClickUp dropdown
            <span className="section-count">{unknown.length}</span>
          </div>
          <p className="section-note">Client field value doesn't match any option in the live dropdown. Add in ClickUp if this is a new transitioned client.</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Task Name</th><th>Client Value</th><th>Source</th><th>List</th></tr></thead>
              <tbody>
                {unknown.map(r => (
                  <tr key={r.taskId}>
                    <td><a href={`https://app.clickup.com/t/${r.taskId}`} target="_blank" rel="noreferrer" className="task-link">{r.taskName}</a></td>
                    <td className="flag">{r.client}</td>
                    <td className="muted">{r.taskSource || '—'}</td>
                    <td className="muted">{r.list}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Override */}
      {!allEqual && fixedIds.size < gaps.length && (
        <div className="override-section">
          <label className="override-checkbox">
            <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} />
            Proceed anyway (override reconciliation)
          </label>
          {override && (
            <input type="text" className="field-input override-reason" placeholder="Reason for override…"
              value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
          )}
        </div>
      )}

      <div className="proceed-bar">
        <button className={`btn-primary ${!canProceed ? 'btn-disabled' : ''}`}
          onClick={canProceed ? onProceed : undefined} disabled={!canProceed}>
          {allEqual || fixedIds.size >= gaps.length ? 'Proceed to Tracker →' : 'Fix gaps first (or override above)'}
        </button>
      </div>
    </div>
  )
}
