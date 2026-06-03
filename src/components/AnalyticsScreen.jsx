import { useMemo } from 'react'

function sortDesc(entries) {
  return [...entries].sort((a, b) => {
    if (!a.label || a.label.startsWith('—')) return 1
    if (!b.label || b.label.startsWith('—')) return -1
    return b.count - a.count
  })
}

function BarRow({ label, count, max, color }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
      <div style={{ width:180, fontSize:12, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0 }}
           title={label}>
        {label}
      </div>
      <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.06)', borderRadius:9999, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:9999, transition:'width 0.4s ease' }} />
      </div>
      <div style={{ width:32, textAlign:'right', fontSize:13, fontWeight:700, color:'var(--text)', flexShrink:0 }}>
        {count}
      </div>
    </div>
  )
}

function Section({ title, entries, color, emptyMsg }) {
  const max = entries[0]?.count || 1
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14, padding:'20px 24px', flex:1, minWidth:0 }}>
      <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:4 }}>
        {title}
      </div>
      <div style={{ fontSize:32, fontWeight:900, letterSpacing:'-1px', color, marginBottom:20 }}>
        {entries.length}
      </div>
      {entries.length === 0
        ? <div style={{ fontSize:12, color:'var(--text-dim)', padding:'20px 0', textAlign:'center' }}>{emptyMsg}</div>
        : entries.map(e => (
            <BarRow key={e.label} label={e.label} count={e.count} max={max} color={color} />
          ))
      }
    </div>
  )
}

export default function AnalyticsScreen({ sets, billingMonth }) {
  const tasks = sets.A

  const clientData = useMemo(() => {
    const map = {}
    tasks.forEach(r => {
      const k = r.client || '— No client'
      map[k] = (map[k] || 0) + 1
    })
    return sortDesc(Object.entries(map).map(([label, count]) => ({ label, count })))
  }, [tasks])

  const designerData = useMemo(() => {
    const map = {}
    tasks.forEach(r => {
      const k = r.designer || '— Unassigned'
      map[k] = (map[k] || 0) + 1
    })
    return sortDesc(Object.entries(map).map(([label, count]) => ({ label, count })))
  }, [tasks])

  return (
    <div style={{ padding:'28px 32px 80px' }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:4 }}>
          Set A · {billingMonth}
        </div>
        <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.5px' }}>
          Analytics
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
          {tasks.length} invoiced tasks
        </div>
      </div>

      <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
        <Section
          title="By Client"
          entries={clientData}
          color="var(--lime)"
          emptyMsg="No tasks in Set A"
        />
        <Section
          title="By Designer"
          entries={designerData}
          color="var(--blue)"
          emptyMsg="No designer data"
        />
      </div>
    </div>
  )
}
