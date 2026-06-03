import { useState, useEffect } from 'react'
import { fetchTransitionedClients } from './api/clickup'
import { parseCSV } from './utils/parseCSV'
import { computeSets } from './utils/sets'
import UploadScreen from './components/UploadScreen'
import ReconciliationScreen from './components/ReconciliationScreen'
import TrackerScreen from './components/TrackerScreen'

function detectBillingMonth() {
  const now = new Date()
  return now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

export default function App() {
  const [screen, setScreen]           = useState('upload')
  const [apiToken, setApiToken]       = useState(import.meta.env.VITE_CLICKUP_TOKEN || '')
  const [clientList, setClientList]   = useState([])
  const [clientListError, setClientListError] = useState(null)
  const [fetchingClients, setFetchingClients] = useState(false)
  const [rows, setRows]               = useState([])
  const [billingMonth, setBillingMonth] = useState(detectBillingMonth)
  const [sets, setSets]               = useState({ D:[], A:[], B:[], C:[] })

  useEffect(() => {
    const token = apiToken.trim()
    if (!token) { setClientList([]); setClientListError(null); return }
    let cancelled = false
    setFetchingClients(true)
    setClientListError(null)
    fetchTransitionedClients(token)
      .then(clients => { if (!cancelled) setClientList(clients) })
      .catch(err   => { if (!cancelled) { setClientList([]); setClientListError(err.message || 'Failed to fetch client list') } })
      .finally(()  => { if (!cancelled) setFetchingClients(false) })
    return () => { cancelled = true }
  }, [apiToken])

  useEffect(() => {
    if (rows.length === 0 || clientList.length === 0) { setSets({ D:[], A:[], B:[], C:[] }); return }
    setSets(computeSets(rows, clientList, billingMonth))
  }, [rows, clientList, billingMonth])

  function onCSVLoaded(text) {
    try {
      const parsed = parseCSV(text)
      if (parsed.length === 0) { alert('No valid tasks found in CSV.'); return }
      setRows(parsed)
      // Auto-detect billing month from most common Billing Month value in the CSV
      const counts = {}
      for (const r of parsed) {
        if (r.billingMonth) counts[r.billingMonth] = (counts[r.billingMonth] || 0) + 1
      }
      const detected = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
      if (detected) setBillingMonth(detected)
      setScreen('recon')
    } catch (err) {
      alert(`Failed to parse CSV: ${err.message}`)
    }
  }

  return (
    <div className="app">
      {screen === 'upload' && (
        <UploadScreen
          onCSVLoaded={onCSVLoaded}
          apiToken={apiToken}
          setApiToken={setApiToken}
          clientList={clientList}
          clientListError={clientListError}
          fetchingClients={fetchingClients}
        />
      )}
      {screen === 'recon' && (
        <ReconciliationScreen
          rows={rows}
          sets={sets}
          clientList={clientList}
          billingMonth={billingMonth}
          setBillingMonth={setBillingMonth}
          apiToken={apiToken}
          onProceed={() => setScreen('tracker')}
          onReupload={() => { setRows([]); setSets({ D:[], A:[], B:[], C:[] }); setScreen('upload') }}
        />
      )}
      {screen === 'tracker' && (
        <TrackerScreen sets={sets} billingMonth={billingMonth} clientList={clientList} onBack={() => setScreen('recon')} />
      )}
    </div>
  )
}
