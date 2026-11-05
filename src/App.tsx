import { useState } from 'react'
import { Camp, Tab } from './types'
import { useCampData } from './hooks/useCampData'
import { I18nProvider, useI18n } from './lib/I18nContext'
import { readAdminSession, writeAdminSession } from './lib/auth'
import AppShell from './components/ui/AppShell'
import FrontPage from './components/ui/FrontPage'
import ContactsPage from './components/ui/ContactsPage'
import CampList from './components/ui/CampList'
import CampForm from './components/ui/CampForm'
import StudentAdmin from './components/ui/StudentAdmin'
import SettingsForm from './components/ui/SettingsForm'
import AdminGate from './components/ui/AdminGate'
import R1Attendance from './components/reports/R1Attendance'
import R2Master from './components/reports/R2Master'
import R3Notice from './components/reports/R3Notice'

const ADMIN_TABS: Tab[] = ['camps', 'students', 'settings', 'r1', 'r2', 'r3']

function AppInner() {
  const d = useCampData()
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('front')
  const [editing, setEditing] = useState<Camp | null | 'new'>(null)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => readAdminSession())
  // 學生登入狀態僅存在記憶體：重整後必須重新輸入密碼，避免個資殘留
  const [loggedInStudentId, setLoggedInStudentId] = useState<string | null>(null)
  const [studentSessionPassword, setStudentSessionPassword] = useState('')

  const requestTab = (next: Tab) => {
    setTab(next)
    setEditing(null)
  }

  const needsAdmin = ADMIN_TABS.includes(tab)
  const showAdminGate = needsAdmin && !isAdminAuthenticated
  const rp = { students: d.students, camps: d.camps, regs: d.regs, profiles: d.profiles }

  if (d.loading) return <p className="p-4">{t('loading')}</p>

  return (
    <AppShell
      tab={tab}
      onTab={requestTab}
      settings={d.settings}
      isAdminAuthenticated={isAdminAuthenticated}
      onAdminLogout={() => {
        writeAdminSession(false)
        setIsAdminAuthenticated(false)
        d.clearStudentPii()
        setTab('front')
      }}
      studentLoggedIn={!!loggedInStudentId}
    >
      {showAdminGate && (
        <AdminGate
          onVerify={async (password) => {
            await d.verifyAdmin(password)
            writeAdminSession(true, password)
            setIsAdminAuthenticated(true)
          }}
        />
      )}

      {!showAdminGate && tab === 'front' && (
        <FrontPage
          {...rp}
          settings={d.settings}
          loggedInStudentId={loggedInStudentId}
          getProfile={d.getProfile}
          onLogin={async (id, password) => {
            const r = await d.loginStudent(id, password)
            if (r.ok) {
              setLoggedInStudentId(id)
              setStudentSessionPassword(password)
              return { ok: true as const }
            }
            return { ok: false as const, message: r.message, locked: r.locked }
          }}
          onLogout={() => {
            d.clearStudentPii(loggedInStudentId)
            setLoggedInStudentId(null)
            setStudentSessionPassword('')
          }}
          onChangePassword={async (studentId, currentPassword, next) => {
            const r = await d.changeStudentPassword(studentId, currentPassword, next)
            if (r.success) setStudentSessionPassword(next)
            return r
          }}
          onEnroll={d.enroll}
          onCancel={d.cancel}
          onLeave={d.requestLeave}
        />
      )}

      {!showAdminGate && tab === 'contacts' && loggedInStudentId && (() => {
        const stu = d.students.find(s => s.student_id === loggedInStudentId)
        if (!stu) return <p className="text-slate-500">Student not found</p>
        return (
          <ContactsPage
            student={stu}
            profile={d.getProfile(loggedInStudentId)}
            sessionPassword={studentSessionPassword}
            onSave={async (contacts, currentPassword) => {
              const r = await d.saveEmergencyContacts(loggedInStudentId, currentPassword, contacts)
              if (r.success) setStudentSessionPassword(currentPassword)
              return r
            }}
          />
        )
      })()}

      {!showAdminGate && tab === 'contacts' && !loggedInStudentId && (
        <p className="text-slate-500">{t('pass.needLogin')}</p>
      )}

      {!showAdminGate && tab === 'camps' && (editing
        ? <CampForm
            initial={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSave={async c => { await d.saveCamp(c); setEditing(null) }}
          />
        : <CampList
            {...rp}
            onNew={() => setEditing('new')}
            onEdit={setEditing}
            onDelete={d.deleteCamp}
            onAutoAssign={d.autoAssign}
            onSetSubClass={d.setSubClass}
          />)}

      {!showAdminGate && tab === 'students' && (
        <StudentAdmin
          students={d.students}
          profiles={d.profiles}
          getProfile={d.getProfile}
          onUnlock={d.unlockStudent}
          onResetPassword={d.resetStudentPassword}
          onSaveContacts={d.adminSaveContacts}
        />
      )}

      {!showAdminGate && tab === 'settings' && d.settings && (
        <SettingsForm settings={d.settings} onSave={d.saveSettings} />
      )}

      {!showAdminGate && tab === 'r1' && <R1Attendance {...rp} />}
      {!showAdminGate && tab === 'r2' && <R2Master {...rp} />}
      {!showAdminGate && tab === 'r3' && <R3Notice {...rp} />}
    </AppShell>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  )
}
