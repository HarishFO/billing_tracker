import { useState } from 'react'
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

// Inline editor for a single missing field
function FieldEditor({ fieldLabel, taskId, apiToken, clientList, onFixed }) {
  const meta = DQ_FIELDS[fieldLabel]
  const [value, setValue] = useState('')
  const [state, setState] = useState('idle') // idle | saving | done | error
  const [errMsg, setErrMsg] = useState('')

  if (!meta) return null

  // For client field, use the live clientList from app state
  // We need the option ID — fetch it from the live dropdown
  // For now, for client we open the task link since we don't have option IDs baked in for clients
  if (fieldLabel === 'Client (transitioned)') {
    return <span className="muted small">Set in ClickUp</span>
  }

  const options = meta.optionsKey ? FIELD_OPTIONS[meta.optionsKey] : null

  async function save() {
    if (!value) return
    setState('saving')
    try {
      await writeField(taskId, meta.fieldId, value, apiToken)
      setState('done')
      onFixed && onFixed(fieldLabel)
    } catch (e) {
      setState('error')
      setErrMsg(e.message)
    }
  }

  if (state === 'done') return <span className="fix-btn fixed">✓ Fixed</span>
  if (state === 'error') return <span className="fix-btn error" title={errMsg}>✗ Failed</span>

  return (
    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
      {options ? (
        <select
          className="field-input"
          style={{ fontSize:11, padding:'3px 6px', minWidth:120 }}
          value={value}
          onChange={e => setValue(e.target.value)}
        >
          <option value="">Select…</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      ) : (
        <input
          type="text"
          className="field-input"
          style={{ fontSize:11, padding:'3px 8px', minWidth:120 }}
          placeholder={fieldLabel}
          value={value}
          onChange={e => setValue(e.target.value)}
        />
      )}
      <button
        className={`fix-btn ${state === 'saving' ? 'fixing' : ''}`}
        onClick={save}
        disabled={!value || state === 'saving'}
      >
        {state === 'saving' ? '⟳' : '⚡'}
      </button>
    </div>
  )
}

// Full DQ fix row — shows one editor per missing field
export default function DQFixRow({ task, apiToken, clientList }) {
  const [fixed, setFixed] = useState(new Set())

  function onFixed(fieldLabel) {
    setFixed(prev => new Set([...prev, fieldLabel]))
  }

  const remaining = task.missingFields.filter(f => !fixed.has(f))

  if (remaining.length === 0) {
    return <span className="fix-btn fixed">✓ All fixed</span>
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      {task.missingFields.map(f => (
        <div key={f} style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, color:'var(--text-muted)', width:120, flexShrink:0 }}>{f}</span>
          {fixed.has(f)
            ? <span className="fix-btn fixed" style={{ fontSize:10 }}>✓</span>
            : <FieldEditor fieldLabel={f} taskId={task.taskId} apiToken={apiToken} clientList={clientList} onFixed={onFixed} />
          }
        </div>
      ))}
    </div>
  )
}
