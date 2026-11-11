import { useState } from 'react'
import { Camp, Tab } from './types'
import { useCampData } from './hooks/useCampData'
import { I18nProvider, useI18n } from './lib/I18nContext'
import { readAdminSession, writeAdminSession } from './lib/auth'
import { activateAdmin, activateStudent } from './lib/session'
import AppShell from './components/ui/AppShell'
import FrontPage from './components/ui/FrontPage'
import ProfilePage from './components/ui/ProfilePage'
import StatusPage from './components/ui/StatusPage'
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

  const requestTab = (next: Tab) => { setTab(next); setEditing(null) }
  const showAdminGate = ADMIN_TABS.includes(tab) && !isAdminAuthenticated
  const rp = { students: d.students, camps: d.camps, regs: d.regs, profiles: d.profiles }
  const student = loggedInStudentId ? d.students.find(s => s.student_id === loggedInStudentId) : undefined

  /** 前後台互斥：學生登出（記憶體狀態 + storage 殘留） */
  const logoutStudent = () => {
    d.clearStudentPii(loggedInStudentId)
    setLoggedInStudentId(null)
    setStudentSessionPassword('')
  }

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
            await d.verifyAdmin(password) // 成功後後台已載入全校資料（也會覆蓋學生個資）
            activateAdmin(password)       // 寫入後台工作階段，並清除 storage 內的學生登入殘留
            setLoggedInStudentId(null)    // 互斥：後台登入成功 → 自動登出學生
            setStudentSessionPassword('')
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
            if (!r.ok) return { ok: false as const, message: r.message, locked: r.locked }
            activateStudent()               // 互斥：學生登入成功 → 自動登出後台（兩種 storage 都清）
            setIsAdminAuthenticated(false)
            d.keepOnlyProfile(id)           // 丟棄後台載入的全校個資，只留本人
            setLoggedInStudentId(id)
            setStudentSessionPassword(password)
            return { ok: true as const }
          }}
          onLogout={logoutStudent}
          onEnroll={d.enroll}
          onNavigate={requestTab}
        />
      )}

      {!showAdminGate && tab === 'status' && (student
        ? <StatusPage student={student} camps={d.camps} regs={d.regs} settings={d.settings}
            onCancel={d.cancel} onLeave={d.requestLeave} onGoHome={() => requestTab('front')} />
        : <p className="text-slate-500">{t('pass.needLogin')}</p>)}

      {!showAdminGate && tab === 'profile' && (student
        ? <ProfilePage
            student={student}
            profile={d.getProfile(student.student_id)}
            sessionPassword={studentSessionPassword}
            onSaveContacts={async (contacts, currentPassword) => {
              const r = await d.saveEmergencyContacts(student.student_id, currentPassword, contacts)
              if (r.success) setStudentSessionPassword(currentPassword)
              return r
            }}
            onChangePassword={async (studentId, currentPassword, next) => {
              const r = await d.changeStudentPassword(studentId, currentPassword, next)
              if (r.success) setStudentSessionPassword(next)
              return r
            }}
          />
        : <p className="text-slate-500">{t('pass.needLogin')}</p>)}

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
            onPromote={d.promoteWaitlist}
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
