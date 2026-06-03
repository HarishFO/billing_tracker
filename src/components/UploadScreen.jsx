import { useRef, useState } from 'react'

const LOGO = '/mnt/skills/organization/optimite-brand-guidelines/assets/optimite-logo-white.webp'

export default function UploadScreen({ onCSVLoaded, apiToken, setApiToken, clientList, clientListError, fetchingClients }) {
  const fileRef = useRef()
  const [dragOver, setDragOver] = useState(false)

  function readFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => onCSVLoaded(e.target.result, file.name)
    reader.readAsText(file)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) readFile(file)
    else alert('Please drop a .csv file')
  }

  const tokenStatus = fetchingClients ? 'loading'
    : clientListError ? 'err'
    : clientList.length > 0 ? 'ok'
    : ''

  return (
    <div className="upload-screen">
<div className="upload-box">
        <div>
          <div className="upload-section-label">ClickUp API Token</div>
          <div className="token-row">
            <input
              type="password"
              className="token-input"
              placeholder="pk_..."
              value={apiToken}
              onChange={e => setApiToken(e.target.value)}
              autoComplete="off"
            />
          </div>
          {tokenStatus === 'loading' && <div className="token-status loading">Fetching client list…</div>}
          {tokenStatus === 'ok'      && <div className="token-status ok">✓ {clientList.length} clients loaded</div>}
          {tokenStatus === 'err'     && <div className="token-status err">✗ {clientListError}</div>}
        </div>

        <div>
          <div className="upload-section-label">CSV Export</div>
          <div
            className={`dropzone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div className="dropzone-icon">📂</div>
            <div className="dropzone-label">Drop your ClickUp CSV here</div>
            <div className="dropzone-sub">or click to browse · EM Space export · all lists included</div>
            <input ref={fileRef} type="file" accept=".csv" onChange={e => readFile(e.target.files[0])} />
          </div>
        </div>
      </div>
    </div>
  )
}
