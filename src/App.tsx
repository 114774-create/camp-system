// 【鎖定】此檔只負責接線：hooks → 元件。外觀請改 components/ui/*，不要動這裡。
import { useState } from 'react'
import { Camp } from './types'
import { useCampData } from './hooks/useCampData'
import AppShell, { Tab } from './components/ui/AppShell'
import FrontPage from './components/ui/FrontPage'
import CampList from './components/ui/CampList'
import CampForm from './components/ui/CampForm'
import R1Attendance from './components/reports/R1Attendance'
import R2Master from './components/reports/R2Master'
import R3Notice from './components/reports/R3Notice'
export default function App() {
  const d = useCampData()
  const [tab, setTab] = useState<Tab>('front')
  const [editing, setEditing] = useState<Camp | null | 'new'>(null)
  const rp = { students: d.students, camps: d.camps, regs: d.regs }
  if (d.loading) return <p className="p-4">載入中…</p>
  return <AppShell tab={tab} onTab={t => { setTab(t); setEditing(null) }}>
    {tab === 'front' && <FrontPage {...rp} onEnroll={d.enroll} onCancel={d.cancel} />}
    {tab === 'camps' && (editing
      ? <CampForm initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSave={async c => { await d.saveCamp(c); setEditing(null) }} />
      : <CampList {...rp} onNew={() => setEditing('new')} onEdit={setEditing} onDelete={d.deleteCamp} onAutoAssign={d.autoAssign} onSetSubClass={d.setSubClass} />)}
    {tab === 'r1' && <R1Attendance {...rp} />}
    {tab === 'r2' && <R2Master {...rp} />}
    {tab === 'r3' && <R3Notice {...rp} />}
  </AppShell>
}
