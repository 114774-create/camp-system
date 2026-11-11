// 渲染冒煙測試：確保三個學生分頁、後台候補面板在含候補資料時能正常繪出
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Camp, Registration, Student } from '../types'
import { I18nProvider } from '../lib/I18nContext'
import FrontPage from './ui/FrontPage'
import StatusPage from './ui/StatusPage'
import ProfilePage from './ui/ProfilePage'
import CampList from './ui/CampList'
import AppShell from './ui/AppShell'
import { emptyProfileView } from '../lib/auth'

const camp = { id: 'a', term: 'T', season: 'summer', name: '桌遊營', attendance_mode: 'full_course', dates: ['2026-07-06', '2026-07-07'], start_time: '09:00', end_time: '12:00', allowed_grades: [1, 2, 3, 4, 5, 6], max_capacity: 1, ignore_time_conflict: false, allow_concurrent_with: [], has_sub_classes: false, sub_classes: [], location: '會議室', teacher: '王老師', notes: '' } as Camp
const s1: Student = { student_id: '10101', grade: 1, classCode: '101', no: 1, name: '王小明' }
const s2: Student = { student_id: '10102', grade: 1, classCode: '101', no: 2, name: '李小華' }
const regs: Registration[] = [
  { id: 'r1', student_id: '10101', camp_id: 'a', status: 'enrolled', created_at: '2026-07-01T00:00:00Z' },
  { id: 'r2', student_id: '10102', camp_id: 'a', status: 'waitlisted', created_at: '2026-07-02T00:00:00Z' },
]
const wrap = (el: JSX.Element) => renderToString(<I18nProvider>{el}</I18nProvider>)
const noop = async () => ({ ok: true as const })

describe('render smoke', () => {
  it('前台首頁：有教學、營隊清單顯示「額滿，排入候補」，且不含修改密碼欄位', () => {
    const html = wrap(<FrontPage students={[s1, s2]} camps={[camp]} regs={regs.slice(0, 1)} settings={null} loggedInStudentId="10102"
      getProfile={id => ({ ...emptyProfileView(id), emergency_contacts: [{ name: 'a', relation: 'b', phone: '1', is_primary: true }] })}
      onLogin={async () => ({ ok: true })} onLogout={() => {}} onEnroll={noop} />)
    expect(html).toContain('家長與學生使用教學'); expect(html).toContain('額滿，排入候補'); expect(html).not.toContain('目前密碼')
  })
  it('我的報名狀態：候補顯示順位、含地點與時間', () => {
    const html = wrap(<StatusPage student={s2} camps={[camp]} regs={regs} settings={null} onCancel={noop} onLeave={noop} />)
    expect(html).toContain('候補中・第 1 順位'); expect(html).toContain('會議室'); expect(html).toContain('09:00'); expect(html).toContain('12:00')
  })
  it('個人資料與設定：聯絡人與密碼在同一頁', () => {
    const html = wrap(<ProfilePage student={s1} profile={emptyProfileView('10101')} sessionPassword="" onSaveContacts={async () => ({ success: false, remaining_attempts: 5, is_locked: false, message: '' })} onChangePassword={async () => ({ success: false, remaining_attempts: 5, is_locked: false, message: '' })} />)
    expect(html).toContain('目前密碼'); expect(html).toContain('緊急聯絡人')
  })
  it('後台：候補名單與「遞補轉正」按鈕（滿額時停用）', () => {
    const html = wrap(<CampList students={[s1, s2]} camps={[camp]} regs={regs} onNew={() => {}} onEdit={() => {}} onDelete={() => {}} onAutoAssign={() => {}} onSetSubClass={() => {}} onPromote={noop} />)
    expect(html).toContain('候補名單'); expect(html).toContain('遞補轉正'); expect(html).toContain('disabled')
  })
  it('導覽：登入後出現「我的報名狀態」「個人資料與設定」', () => {
    const html = wrap(<AppShell tab="front" onTab={() => {}} isAdminAuthenticated={false} onAdminLogout={() => {}} studentLoggedIn>x</AppShell>)
    expect(html).toContain('我的報名狀態'); expect(html).toContain('個人資料與設定'); expect(html).toContain('營隊報名與首頁')
  })
})
