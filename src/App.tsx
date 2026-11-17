import { useState } from 'react'
import { Camp, Tab } from './types'
import { useCampData } from './hooks/useCampData'
import { I18nProvider, useI18n } from './lib/I18nContext'
import { readAdminSession, writeAdminSession } from './lib/auth'
import { activateAdmin, activateStudent } from './lib/session'
import { parseRoute } from './lib/route'
import { duplicateTemplate } from './lib/sessions'
import { addSession, MAX_SESSIONS, nextActiveId, removeSession, StudentSession, updatePassword } from './lib/siblings'
import AppShell from './components/ui/AppShell'
import AlertBanner from './components/ui/AlertBanner'
import SiblingBar from './components/ui/SiblingBar'
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
import TeacherRollCall from './components/teacher/TeacherRollCall'

const ADMIN_TABS: Tab[] = ['camps', 'students', 'settings', 'r1', 'r2', 'r3']
const STUDENT_TABS: Tab[] = ['front', 'status', 'profile']

function AppInner() {
  const d = useCampData()
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('front')
  const [editing, setEditing] = useState<Camp | null | 'new'>(null)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => readAdminSession())
  // 學生登入狀態僅存在記憶體（可同時登入多位手足）：重整後必須重新輸入密碼，避免個資殘留
  const [sessions, setSessions] = useState<StudentSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const loggedInStudentId = activeId
  const studentSessionPassword = sessions.find(s => s.id === activeId)?.password ?? ''

  const requestTab = (next: Tab) => { setTab(next); setEditing(null) }
  const showAdminGate = ADMIN_TABS.includes(tab) && !isAdminAuthenticated
  const rp = { students: d.students, camps: d.camps, regs: d.regs, profiles: d.profiles }
  const student = loggedInStudentId ? d.students.find(s => s.student_id === loggedInStudentId) : undefined

  /** 前後台互斥：登出所有學生（記憶體狀態 + 個資） */
  const logoutStudent = () => { d.clearStudentPii(); setSessions([]); setActiveId(null) }

  const removeSibling = (id: string) => {
    const rest = removeSession(sessions, id)
    setSessions(rest); setActiveId(nextActiveId(rest, activeId, id)); d.clearStudentPii(id)
    if (!rest.length) setTab('front')
  }

  const addSibling = async (sibId: string, sibPwd: string) => {
    const a = sessions.find(s => s.id === activeId)
    const id = sibId.trim()
    if (!a) return { ok: false, message: '請先登入' }
    if (sessions.length >= MAX_SESSIONS) return { ok: false, message: `最多同時綁定 ${MAX_SESSIONS} 位學生` }
    if (sessions.some(s => s.id === id)) return { ok: false, message: '這位學生已經在切換列中' }
    const sib = d.students.find(s => s.student_id === id)
    if (!sib) return { ok: false, message: '查無此學號' }
    const r = await d.addSibling({ id: a.id, password: a.password }, { id, password: sibPwd })
    if (!r.success) return { ok: false, message: r.message }
    setSessions(l => addSession(l, { id, password: sibPwd })); setActiveId(id)
    return { ok: true, message: r.copied ? `已新增 ${sib.classCode}-${sib.no}，並把目前帳號的緊急聯絡人同步給他／她` : `已新增 ${sib.classCode}-${sib.no}，已切換為此帳號` }
  }

  if (d.loading) return <p className="p-4">{t('loading')}</p>

  return (
    <>
      <AlertBanner message={d.settings?.global_alert_message} active={d.settings?.global_alert_active} />
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
              setSessions([]); setActiveId(null)  // 互斥：後台登入成功 → 自動登出所有學生
              setIsAdminAuthenticated(true)
            }}
          />
        )}

        {!showAdminGate && STUDENT_TABS.includes(tab) && sessions.length > 0 && (
          <div className="mb-4">
            <SiblingBar
              students={d.students}
              sessionIds={sessions.map(s => s.id)}
              activeId={activeId}
              maxReached={sessions.length >= MAX_SESSIONS}
              onSwitch={setActiveId}
              onRemove={removeSibling}
              onAdd={addSibling}
            />
          </div>
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
              setSessions([{ id, password }]); setActiveId(id)
              return { ok: true as const }
            }}
            onLogout={logoutStudent}
            onEnroll={d.enroll}
            onNavigate={requestTab}
            onResetPassword={d.resetPasswordByPhone}
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
                if (r.success) setSessions(l => updatePassword(l, student.student_id, currentPassword))
                return r
              }}
              onChangePassword={async (studentId, currentPassword, next) => {
                const r = await d.changeStudentPassword(studentId, currentPassword, next)
                if (r.success) setSessions(l => updatePassword(l, studentId, next))
                return r
              }}
            />
          : <p className="text-slate-500">{t('pass.needLogin')}</p>)}

        {!showAdminGate && tab === 'camps' && (editing
          ? <CampForm
              initial={editing === 'new' ? null : editing}
              onCancel={() => setEditing(null)}
              onSave={async cs => { for (const c of cs) await d.saveCamp(c); setEditing(null) }}
            />
          : <CampList
              {...rp}
              teacherPins={d.teacherPins}
              onNew={() => setEditing('new')}
              onEdit={c => setEditing({ ...c, teacher_pin: d.teacherPins[c.id] })}
              onDuplicate={c => setEditing(duplicateTemplate(c))}
              onDelete={d.deleteCamp}
              onAutoAssign={d.autoAssign}
              onSetSubClass={d.setSubClass}
              onPromote={d.promoteWaitlist}
            />)}

        {!showAdminGate && tab === 'students' && (
          <StudentAdmin
            students={d.students}
            profiles={d.profiles}
            regs={d.regs}
            onCancelAllRegs={d.adminCancelRegistrations}
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
    </>
  )
}

export default function App() {
  // 極簡路由：/teacher-rollcall/:camp_id 為獨立的手機點名頁，不載入學生／後台資料
  const route = typeof location !== 'undefined' ? parseRoute(location.pathname) : null
  return (
    <I18nProvider>
      {route?.name === 'teacher' ? <TeacherRollCall campId={route.campId} /> : <AppInner />}
    </I18nProvider>
  )
}
