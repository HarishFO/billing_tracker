import { useState, useMemo, useRef, useEffect } from 'react'
import { FIELD_OPTIONS, DQ_FIELDS } from '../utils/fieldOptions'

function clickupUrl(path) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const base = isLocal ? 'https://api.clickup.com' : '/api/clickup'
  return `${base}${path}`
}

async function writeField(taskId, fieldId, value, apiToken) {
  const res = await fetch(clickupUrl(`/api/v2/task/${taskId}/field/${fieldId}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiToken },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.err || `HTTP ${res.status}`)
  }
}

// Searchable dropdown component
function SearchableSelect({ options, value, onChange, placeholder = 'Search…' }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef()

  const filtered = useMemo(() =>
    options.filter(o => o.name.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  )

  const selected = options.find(o => o.id === value)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position:'relative', minWidth:180, flex:1 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          background:'var(--bg-card2)', border:'1px solid var(--border)', borderRadius:8,
          padding:'4px 10px', fontSize:12, cursor:'pointer', display:'flex',
          justifyContent:'space-between', alignItems:'center', color: selected ? 'var(--text)' : 'var(--text-dim)'
        }}
      >
        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {selected ? selected.name : 'Select…'}
        </span>
        <span style={{ marginLeft:6, flexShrink:0 }}>▾</span>
      </div>
      {open && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:100,
          background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8,
          marginTop:4, boxShadow:'0 8px 24px rgba(0,0,0,0.4)', maxHeight:220, display:'flex', flexDirection:'column'
        }}>
          <input
            autoFocus
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={placeholder}
            style={{
              background:'transparent', border:'none', borderBottom:'1px solid var(--border)',
              color:'var(--text)', padding:'8px 12px', fontSize:12, outline:'none', flexShrink:0
            }}
          />
          <div style={{ overflowY:'auto', flex:1 }}>
            {filtered.length === 0
              ? <div style={{ padding:'8px 12px', fontSize:11, color:'var(--text-dim)' }}>No results</div>
              : filtered.map(o => (
                <div
                  key={o.id}
                  onClick={() => { onChange(o.id); setOpen(false); setSearch('') }}
                  style={{
                    padding:'7px 12px', fontSize:12, cursor:'pointer',
                    color: o.id === value ? 'var(--lime)' : 'var(--text)',
                    background: o.id === value ? 'rgba(98,216,78,0.08)' : 'transparent',
                    transition:'background 0.1s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = o.id === value ? 'rgba(98,216,78,0.08)' : 'transparent'}
                >
                  {o.name}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

// Single field editor — searchable dropdown or text input
function FieldEditor({ fieldLabel, taskId, apiToken, onFixed, disabled }) {
  const meta = DQ_FIELDS[fieldLabel]
  const [value, setValue] = useState('')
  const [state, setState] = useState('idle')
  const [errMsg, setErrMsg] = useState('')

  if (!meta || fieldLabel === 'Client (transitioned)') {
    return <span className="muted small" style={{ fontSize:11 }}>Fix in ClickUp</span>
  }

  const options = meta.optionsKey ? FIELD_OPTIONS[meta.optionsKey] : null

  async function save() {
    if (!value) return
    setState('saving')
    try {
      await writeField(taskId, meta.fieldId, value, apiToken)
      setState('done')
      // Pass display name (not option ID) so tracker can use it directly
      const displayName = options ? (options.find(o => o.id === value)?.name || value) : value
      onFixed && onFixed(fieldLabel, displayName)
    } catch (e) {
      setState('error')
      setErrMsg(e.message)
    }
  }

  if (state === 'done') return <span className="fix-btn fixed" style={{ fontSize:10 }}>✓</span>
  if (state === 'error') return <span className="fix-btn error" style={{ fontSize:10 }} title={errMsg}>✗</span>

  return (
    <div style={{ display:'flex', gap:4, alignItems:'center', flex:1 }}>
      {options
        ? <SearchableSelect options={options} value={value} onChange={setValue} placeholder={`Search ${fieldLabel}…`} />
        : <input type="text" className="field-input"
            style={{ fontSize:11, padding:'4px 8px', flex:1 }}
            placeholder={fieldLabel} value={value}
            onChange={e => setValue(e.target.value)} />
      }
      <button
        className={`fix-btn ${state === 'saving' ? 'fixing' : ''}`}
        style={{ flexShrink:0 }}
        onClick={save}
        disabled={!value || state === 'saving' || disabled}
      >
        {state === 'saving' ? '⟳' : '⚡'}
      </button>
    </div>
  )
}

// Per-row fix UI
export function DQFixRow({ task, apiToken, onFixed: onParentFixed }) {
  const [fixed, setFixed] = useState(new Set())

  function onFixed(fieldLabel, displayName) {
    setFixed(prev => new Set([...prev, fieldLabel]))
    // Bubble up with taskId so App.jsx can track it
    if (onParentFixed) onParentFixed(task.taskId, fieldLabel, displayName)
  }

  if (task.missingFields.every(f => fixed.has(f))) {
    return <span className="fix-btn fixed">✓ All fixed</span>
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {task.missingFields.map(f => (
        <div key={f} style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, color:'var(--text-muted)', width:130, flexShrink:0 }}>{f}</span>
          {fixed.has(f)
            ? <span className="fix-btn fixed" style={{ fontSize:10 }}>✓</span>
            : <FieldEditor fieldLabel={f} taskId={task.taskId} apiToken={apiToken} onFixed={onFixed} />
          }
        </div>
      ))}
    </div>
  )
}

// Bulk fix panel — shown above the table when tasks are selected
export function BulkFixPanel({ selectedTasks, apiToken, onBulkFixed }) {
  const [field, setField] = useState('')
  const [value, setValue] = useState('')
  const [state, setState] = useState('idle') // idle | running | done
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  // Find fields that are missing across all selected tasks
  const missingAcrossAll = useMemo(() => {
    const counts = {}
    for (const t of selectedTasks) {
      for (const f of t.missingFields) {
        counts[f] = (counts[f] || 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([f, count]) => ({ field: f, count }))
  }, [selectedTasks])

  const meta = field ? DQ_FIELDS[field] : null
  const options = meta?.optionsKey ? FIELD_OPTIONS[meta.optionsKey] : null

  async function applyAll() {
    if (!field || !value || !meta) return
    const applicable = selectedTasks.filter(t => t.missingFields.includes(field))
    setState('running')
    setProgress({ done: 0, total: applicable.length })

    for (let i = 0; i < applicable.length; i++) {
      try {
        await writeField(applicable[i].taskId, meta.fieldId, value, apiToken)
      } catch (_) {}
      setProgress({ done: i + 1, total: applicable.length })
    }

    setState('done')
    const displayName = options ? (options.find(o => o.id === value)?.name || value) : value
    onBulkFixed && onBulkFixed(field, displayName)
  }

  if (selectedTasks.length === 0) return null

  return (
    <div style={{
      background:'rgba(98,216,78,0.06)', border:'1px solid rgba(98,216,78,0.2)',
      borderRadius:12, padding:'14px 18px', marginBottom:12, display:'flex',
      flexWrap:'wrap', gap:12, alignItems:'center'
    }}>
      <div style={{ fontSize:12, fontWeight:700, color:'var(--lime)', flexShrink:0 }}>
        {selectedTasks.length} tasks selected
      </div>

      {/* Field picker */}
      <select
        className="field-input"
        style={{ fontSize:12, padding:'5px 10px', minWidth:180 }}
        value={field}
        onChange={e => { setField(e.target.value); setValue('') }}
      >
        <option value="">Select field to fix…</option>
        {missingAcrossAll.map(({ field: f, count }) => (
          <option key={f} value={f}>{f} ({count} tasks)</option>
        ))}
      </select>

      {/* Value picker — searchable */}
      {meta && (
        options
          ? <SearchableSelect options={options} value={value} onChange={setValue} placeholder={`Search ${field}…`} />
          : <input type="text" className="field-input"
              style={{ fontSize:12, padding:'5px 10px', minWidth:160 }}
              placeholder={`Value for ${field}`}
              value={value} onChange={e => setValue(e.target.value)} />
      )}

      {/* Apply button */}
      {field && value && (
        <button
          className={`btn-secondary ${state === 'running' ? 'btn-disabled' : ''}`}
          style={{ fontSize:12, padding:'6px 16px' }}
          onClick={applyAll}
          disabled={state === 'running'}
        >
          {state === 'running'
            ? `Fixing ${progress.done}/${progress.total}…`
            : state === 'done'
              ? `✓ Fixed ${progress.total}`
              : `⚡ Apply to ${selectedTasks.filter(t => t.missingFields.includes(field)).length} tasks`
          }
        </button>
      )}
    </div>
  )
}
