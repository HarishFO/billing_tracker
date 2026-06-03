import { useState } from 'react'
import { exportXLSX, exportSetCSV } from '../utils/export'
import { TRACKER_COLS } from '../constants'
import AnalyticsScreen from './AnalyticsScreen'

const EMPTY_MANUAL = {
  taskId: '', taskName: '', client: '', brand: '',
  deliverables: '', billingMonth: '', designer: '', developer: '',
  dateCreated: null, status: 'manual', list: 'Manual', _isManual: true
}

export default function TrackerScreen({ sets, billingMonth, clientList, onBack }) {
  const [activeTab, setActiveTab] = useState('A')
  const [manualRows, setManualRows] = useState([])
  const [showAddRow, setShowAddRow] = useState(false)
  const [newRow, setNewRow] = useState({ ...EMPTY_MANUAL })
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)

  const tabs = [
    { key: 'A',         label: 'Set A — Master', color: 'green' },
    { key: 'B',         label: 'Set B',          color: 'blue' },
    { key: 'C',         label: 'Set C',          color: 'amber' },
    { key: 'analytics', label: 'Analytics',      color: 'lime' },
  ]

  const isAnalytics = activeTab === 'analytics'

  const currentTasks = activeTab === 'A'
    ? [...sets.A, ...manualRows]
    : sets[activeTab] || []

  const filtered = currentTasks.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.taskName?.toLowerCase().includes(q) ||
      r.client?.toLowerCase().includes(q) ||
      r.brand?.toLowerCase().includes(q)
    )
  })

  function addManualRow() {
    if (!newRow.taskName.trim()) return
    setManualRows(prev => [...prev, {
      ...newRow,
      taskId: `manual_${Date.now()}`,
      billingMonth: newRow.billingMonth || billingMonth,
      _isManual: true,
    }])
    setNewRow({ ...EMPTY_MANUAL })
    setShowAddRow(false)
  }

  function removeManualRow(id) {
    setManualRows(prev => prev.filter(r => r.taskId !== id))
  }

  async function handleExportXLSX() {
    setExporting(true)
    try {
      await exportXLSX(sets, manualRows, billingMonth, clientList)
    } finally {
      setExporting(false)
    }
  }

  function formatDate(r) {
    if (!r.dateCreated) return r._isManual ? 'Manual' : '—'
    return r.dateCreated.toLocaleString('en-US', { month: 'long', day: 'numeric' })
  }

  return (
    <div className="tracker-screen">
      <div className="screen-header">
        <div>
          <h2>Billing Tracker — {billingMonth}</h2>
          <div className="header-meta">
            Set A: {sets.A.length + manualRows.length} tasks
            {manualRows.length > 0 && <span className="manual-count"> (+{manualRows.length} manual)</span>}
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={onBack}>← Back</button>
          {!isAnalytics && (
            <button className="btn-secondary" onClick={() => exportSetCSV(currentTasks, activeTab, billingMonth)}>
              Export {activeTab} CSV
            </button>
          )}
          <button className="btn-primary" onClick={handleExportXLSX} disabled={exporting}>
            {exporting ? 'Exporting...' : '↓ Export Tracker XLSX'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'tab-btn--active' : ''}`}
            style={activeTab === t.key ? { borderBottomColor: `var(--${t.color})` } : {}}
            onClick={() => { setActiveTab(t.key); setSearch('') }}
          >
            {t.label}
            {t.key !== 'analytics' && (
              <span className="tab-count">
                {t.key === 'A' ? sets.A.length + manualRows.length : sets[t.key]?.length ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Analytics tab */}
      {isAnalytics && <AnalyticsScreen sets={sets} billingMonth={billingMonth} />}

      {/* Data tabs */}
      {!isAnalytics && (
        <>
          <div className="toolbar">
            <input
              type="text"
              className="search-input"
              placeholder="Search task name, client, brand..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {activeTab === 'A' && (
              <button className="btn-add" onClick={() => setShowAddRow(true)}>+ Add Manual Row</button>
            )}
          </div>

          {showAddRow && activeTab === 'A' && (
            <div className="manual-row-form">
              <div className="manual-row-title">Add Manual Row</div>
              <div className="manual-row-fields">
                {[
                  { key: 'taskName',     placeholder: 'Task name *', required: true },
                  { key: 'client',       placeholder: 'Client' },
                  { key: 'brand',        placeholder: 'Brand' },
                  { key: 'deliverables', placeholder: 'Deliverables' },
                  { key: 'designer',     placeholder: 'Designer' },
                  { key: 'developer',    placeholder: 'Developer' },
                ].map(f => (
                  <input
                    key={f.key}
                    type="text"
                    className="field-input"
                    placeholder={f.placeholder}
                    value={newRow[f.key]}
                    onChange={e => setNewRow(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                ))}
              </div>
              <div className="manual-row-actions">
                <button className="btn-primary" onClick={addManualRow}>Add Row</button>
                <button className="btn-ghost" onClick={() => setShowAddRow(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="table-wrap" style={{ margin:'0 32px' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  {TRACKER_COLS.slice(1).map(c => <th key={c.key}>{c.label}</th>)}
                  <th>Status</th>
                  <th>List</th>
                  {activeTab === 'A' && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={TRACKER_COLS.length + 2 + (activeTab === 'A' ? 1 : 0)} className="empty-row">
                      No tasks
                    </td>
                  </tr>
                )}
                {filtered.map((r, i) => (
                  <tr key={r.taskId || i} className={r._isManual ? 'manual-row' : ''}>
                    <td className="muted">{formatDate(r)}</td>
                    <td>{r.client || <span className="na">—</span>}</td>
                    <td>{r.brand || <span className="na">—</span>}</td>
                    <td>
                      {r._isManual
                        ? <span className="task-name">{r.taskName}</span>
                        : <a href={`https://app.clickup.com/t/${r.taskId}`} target="_blank" rel="noreferrer" className="task-link">{r.taskName}</a>
                      }
                    </td>
                    <td className="muted">{r.deliverables || <span className="na">—</span>}</td>
                    <td className="muted">{r.billingMonth || <span className="na">—</span>}</td>
                    <td>{r.designer || <span className="na">—</span>}</td>
                    <td>{r.developer || <span className="na">—</span>}</td>
                    <td><span className="status-badge">{r.status}</span></td>
                    <td className="muted small">{r.list}</td>
                    {activeTab === 'A' && (
                      <td>
                        {r._isManual && (
                          <button className="remove-btn" onClick={() => removeManualRow(r.taskId)}>×</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="export-footer">
            <div className="export-footer-info">XLSX export contains 3 tabs: Master (Set A + manual), Set B, Set C</div>
            <button className="btn-primary btn-large" onClick={handleExportXLSX} disabled={exporting}>
              {exporting ? 'Exporting...' : `↓ Download ${billingMonth.replace(' ', '_')}_EM_Billing_Tracker.xlsx`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
