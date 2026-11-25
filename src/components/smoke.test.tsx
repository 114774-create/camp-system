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
import CampForm from './ui/CampForm'
import ContactsPage from './ui/ContactsPage'
import R3Notice from './reports/R3Notice'
import AlertBanner from './ui/AlertBanner'
import SiblingBar from './ui/SiblingBar'
import ForgotPasswordPanel from './ui/ForgotPasswordPanel'
import SettingsForm from './ui/SettingsForm'
import TeacherRollCall from './teacher/TeacherRollCall'
import StudentAdmin from './ui/StudentAdmin'
import RegistrationCountdown from './ui/RegistrationCountdown'
import { emptyProfileView } from '../lib/auth'

const camp = { id: 'a', term: 'T', season: 'summer', name: '桌遊營', attendance_mode: 'full_course', dates: ['2026-07-06', '2026-07-07'], start_time: '09:00', end_time: '12:00', allowed_grades: [1, 2, 3, 4, 5, 6], max_capacity: 1, ignore_time_conflict: false, allow_concurrent_with: [], has_sub_classes: false, sub_classes: [], location: '會議室', teacher: '王老師', notes: '' } as Camp
const s1: Student = { student_id: '10101', grade: 1, classCode: '101', no: 1, name: '王小明' }
const s2: Student = { student_id: '10102', grade: 1, classCode: '101', no: 2, name: '李小華' }
const regs: Registration[] = [
  { id: 'r1', student_name: '王小明', snapshot_student_id: '10101', camp_id: 'a', status: 'enrolled', created_at: '2026-07-01T00:00:00Z' },
  { id: 'r2', student_name: '李小華', snapshot_student_id: '10102', camp_id: 'a', status: 'waitlisted', created_at: '2026-07-02T00:00:00Z' },
]
const wrap = (el: JSX.Element) => renderToString(<I18nProvider>{el}</I18nProvider>)
const noop = async () => ({ ok: true as const })

describe('render smoke', () => {
  it('前台首頁：有教學、營隊清單顯示「額滿，排入候補」，且不含修改密碼欄位', () => {
    const html = wrap(<FrontPage students={[s1, s2]} camps={[camp]} regs={regs.slice(0, 1)} settings={null} loggedInStudentId="10102"
      getProfile={id => ({ ...emptyProfileView(id), emergency_contacts: [{ name: '王小美', relation: '母', phone: '0912345678', is_primary: true }] })}
      onLogin={async () => ({ ok: true })} onLogout={() => {}} onEnroll={noop} onResetPassword={async () => ({ success: true, message: '' })} />)
    expect(html).toContain('家長與學生使用教學'); expect(html).toContain('額滿，排入候補'); expect(html).not.toContain('目前密碼')
  })
  it('我的報名狀態：候補顯示順位、含地點與時間', () => {
    const html = wrap(<StatusPage student={s2} camps={[camp]} regs={regs} settings={null} onCancel={noop} onLeave={noop} />)
    expect(html).toContain('候補中・第 1 順位'); expect(html).toContain('會議室'); expect(html).toContain('09:00'); expect(html).toContain('12:00')
  })
  it('聯絡人資料與設定：聯絡人與密碼在同一頁', () => {
    const html = wrap(<ProfilePage student={s1} profile={emptyProfileView('10101')} sessionPassword="" onSaveContacts={async () => ({ success: false, remaining_attempts: 5, is_locked: false, message: '' })} onChangePassword={async () => ({ success: false, remaining_attempts: 5, is_locked: false, message: '' })} />)
    expect(html).toContain('目前密碼'); expect(html).toContain('緊急聯絡人')
  })
  it('後台：名單管理按鈕與「移出名單」（有 onAdminCancel 才出現）', () => {
    const base = { students: [s1, s2], camps: [camp], regs, onNew: () => {}, onEdit: () => {}, onDelete: () => {}, onAutoAssign: () => {}, onSetSubClass: () => {}, onPromote: noop, onDuplicate: () => {}, teacherPins: {} }
    expect(wrap(<CampList {...base} />)).not.toContain('名單管理')
    const html = wrap(<CampList {...base} onAdminCancel={noop} />)
    expect(html).toContain('名單管理'); expect(html).toContain('移出候補')
  })
  it('後台：候補名單與「遞補轉正」按鈕（滿額時停用）', () => {
    const html = wrap(<CampList students={[s1, s2]} camps={[camp]} regs={regs} onNew={() => {}} onEdit={() => {}} onDelete={() => {}} onAutoAssign={() => {}} onSetSubClass={() => {}} onPromote={noop} onDuplicate={() => {}} teacherPins={{}} />)
    expect(html).toContain('候補名單'); expect(html).toContain('遞補轉正'); expect(html).toContain('disabled')
  })
  it('導覽：登入後出現「我的報名狀態」「聯絡人資料與設定」', () => {
    const html = wrap(<AppShell tab="front" onTab={() => {}} isAdminAuthenticated={false} onAdminLogout={() => {}} studentLoggedIn>x</AppShell>)
    expect(html).toContain('我的報名狀態'); expect(html).toContain('聯絡人資料與設定'); expect(html).toContain('營隊報名與首頁')
  })
  it('營隊表單：單日擇一時顯示「每一場次人數上限」', () => {
    const html = wrap(<CampForm initial={{ ...camp, attendance_mode: 'single_day_choice', group_id: 'g', dates: ['2026-12-05'] }} onSave={() => {}} onCancel={() => {}} />)
    expect(html).toContain('每一場次人數上限'); expect(html).toContain('儲存後將建立 1 個場次')
  })
  it('通知單：上半留存、裁切線在簽收回條上方', () => {
    const html = wrap(<R3Notice students={[s1]} camps={[camp]} regs={regs.slice(0, 1)} profiles={[]} />)
    expect(html).toContain('以上資料請家長留存'); expect(html).toContain('沿虛線剪下')
    expect(html.indexOf('以上資料請家長留存')).toBeLessThan(html.indexOf('沿虛線剪下'))
    expect(html.indexOf('沿虛線剪下')).toBeLessThan(html.indexOf('家長簽收回條'))
  })
  it('聯絡人頁：電話格式提示與「清空所有聯絡人」按鈕', () => {
    const html = wrap(<ContactsPage student={s1} sessionPassword="" onSave={async () => ({ success: true } as any)}
      profile={{ ...emptyProfileView('10101'), emergency_contacts: [{ name: '王OO', relation: '父', phone: '0923456781000', is_primary: true }] }} />)
    expect(html).toContain('電話格式不正確'); expect(html).toContain('清空所有聯絡人')
  })
  it('營隊表單：寒／暑／假日三種類型', () => {
    const html = wrap(<CampForm initial={null} onSave={() => {}} onCancel={() => {}} />)
    expect(html).toContain('假日營')
  })
  it('夏令營：六年級學生看到明確提示且按鈕鎖定；其他年級照常', () => {
    const s6: Student = { student_id: '60101', grade: 6, classCode: '601', no: 1, name: '六年級生' }
    const html = wrap(<FrontPage students={[s6]} camps={[camp]} regs={[]} settings={null} loggedInStudentId="60101"
      getProfile={id => ({ ...emptyProfileView(id), emergency_contacts: [{ name: '王小美', relation: '母', phone: '0912345678', is_primary: true }] })}
      onLogin={async () => ({ ok: true })} onLogout={() => {}} onEnroll={noop} onResetPassword={async () => ({ success: true, message: '' })} />)
    expect(html).toContain('六年級畢業生無法報名夏令營'); expect(html).toContain('畢業生不可報名')
  })
  it('登入頁：有「忘記密碼／帳號解鎖」入口', () => {
    const html = wrap(<FrontPage students={[s1]} camps={[camp]} regs={[]} settings={null} loggedInStudentId={null}
      getProfile={emptyProfileView} onLogin={async () => ({ ok: true })} onLogout={() => {}} onEnroll={noop} onResetPassword={async () => ({ success: true, message: '' })} />)
    expect(html).toContain('忘記密碼／帳號解鎖')
  })
  it('忘記密碼面板：學號、主要聯絡人電話、新密碼欄位與 30 分鐘提示', () => {
    const html = wrap(<ForgotPasswordPanel onReset={async () => ({ success: true, message: '' })} />)
    for (const k of ['學號', '主要聯絡人電話', '新密碼', '30 分鐘']) expect(html).toContain(k)
  })
  it('手足切換列：顯示各孩子標籤與「新增手足帳號」', () => {
    const html = wrap(<SiblingBar items={[{ key: '王小明', label: '101-1 王小明' }, { key: '李小華', label: '101-2 李小華' }]} activeKey="李小華" maxReached={false}
      onSwitch={() => {}} onRemove={() => {}} onAdd={async () => ({ ok: true, message: '' })} />)
    expect(html).toContain('101-1'); expect(html).toContain('101-2'); expect(html).toContain('新增手足帳號'); expect(html).toContain('aria-selected="true"')
    expect(wrap(<SiblingBar items={[{ key: '王小明', label: '101-1 王小明' }]} activeKey="王小明" maxReached onSwitch={() => {}} onRemove={() => {}} onAdd={async () => ({ ok: true, message: '' })} />)).not.toContain('新增手足帳號')
  })
  it('公告橫幅：啟用且有內容才顯示', () => {
    expect(renderToString(<AlertBanner message="因颱風停課" active />)).toContain('因颱風停課')
    expect(renderToString(<AlertBanner message="因颱風停課" active={false} />)).toBe('')
    expect(renderToString(<AlertBanner message="  " active />)).toBe('')
  })
  it('系統設定：緊急公告開關與內容欄位', () => {
    const html = wrap(<SettingsForm onSave={async () => {}} settings={{ id: 'default', term_name: 'T', registration_start_at: '2026-01-01T00:00:00Z', registration_end_at: '2026-12-31T00:00:00Z', global_alert_message: '停課公告', global_alert_active: true }} />)
    expect(html).toContain('全站緊急公告'); expect(html).toContain('停課公告')
  })
  it('教師點名簿：先顯示 4 碼 PIN 輸入畫面（未驗證前不洩漏名單）', () => {
    const html = wrap(<TeacherRollCall campId="c1" />)
    expect(html).toContain('教師數位點名簿'); expect(html).toContain('進入點名簿'); expect(html).not.toContain('簽到')
  })
  it('後台營隊卡片：顯示教師 PIN、複製點名連結與「一鍵複製」', () => {
    const html = wrap(<CampList students={[s1]} camps={[camp]} regs={[]} onNew={() => {}} onEdit={() => {}} onDelete={() => {}} onAutoAssign={() => {}} onSetSubClass={() => {}} onPromote={noop} onDuplicate={() => {}} teacherPins={{ a: '4821' }} />)
    expect(html).toContain('4821'); expect(html).toContain('複製點名連結'); expect(html).toContain('一鍵複製')
  })
  it('營隊表單：教師 PIN 欄位（新增模式自動帶入 4 碼）', () => {
    const html = wrap(<CampForm initial={null} onSave={() => {}} onCancel={() => {}} />)
    expect(html).toContain('教師點名 PIN'); expect(html).toMatch(/maxLength="4"|maxlength="4"/i)
  })
  it('後台學生管理：偵測到同名同姓時顯示警告', () => {
    const props = { students: [s1], profiles: [], regs: [], onCancelAllRegs: async () => {}, getProfile: emptyProfileView, onUnlock: async () => {}, onResetPassword: async () => {}, onSaveContacts: async () => {} }
    expect(wrap(<StudentAdmin {...props} duplicateNames={['王小明']} />)).toContain('偵測到同名同姓：王小明')
    expect(wrap(<StudentAdmin {...props} />)).not.toContain('偵測到同名同姓')
  })
  describe('報名倒數面板', () => {
    const H = 3600_000, D = 24 * H
    const NOW = Date.UTC(2026, 10, 20, 0, 0, 0)
    const st = (startOffset: number | null, endOffset: number | null) => ({
      id: 'default', term_name: 'T', global_alert_message: '', global_alert_active: false,
      registration_start_at: startOffset === null ? '' : new Date(NOW + startOffset).toISOString(),
      registration_end_at: endOffset === null ? '' : new Date(NOW + endOffset).toISOString(),
    })
    const html = (s: ReturnType<typeof st>, now = NOW) => wrap(<RegistrationCountdown settings={s} nowMs={now} />)
    it('狀態 A 尚未開放：藍色，顯示距離開放時間', () => {
      const h = html(st(2 * D + 3 * H + 4 * 60_000 + 5_000, 10 * D))
      expect(h).toContain('⏳ 距離報名開放還有：'); expect(h).toContain('data-phase="upcoming"'); expect(h).toContain('sky')
      expect(h).toContain('>2<'); expect(h).toContain('>03<'); expect(h).toContain('>04<'); expect(h).toContain('>05<')
    })
    it('狀態 B 倒數截止：大於 3 天綠色；1～3 天橘色；不含呼吸閃爍', () => {
      const calm = html(st(-D, 10 * D)), soon = html(st(-D, 2 * D))
      expect(calm).toContain('🔥 距離報名截止剩餘：'); expect(calm).toContain('emerald'); expect(calm).not.toContain('camp-breath')
      expect(soon).toContain('orange'); expect(soon).not.toContain('camp-breath')
    })
    it('狀態 B 最後 24 小時：紅色＋呼吸閃爍；恰好 24 小時還不算', () => {
      const urgent = html(st(-D, 23 * H + 59 * 60_000))
      expect(urgent).toContain('data-phase="urgent"'); expect(urgent).toContain('camp-breath'); expect(urgent).toContain('red-'); expect(urgent).toContain('最後 24 小時')
      expect(html(st(-D, D))).not.toContain('camp-breath')
      expect(html(st(-D, D - 1000))).toContain('camp-breath')
    })
    it('狀態 C 已截止：顯示截止訊息，隱藏跳動數字；截止當下（歸零瞬間）即為截止', () => {
      const closed = html(st(-10 * D, -D))
      expect(closed).toContain('🚫 本期報名已全面截止'); expect(closed).not.toContain('role="timer"'); expect(closed).not.toContain('小時')
      expect(html(st(-D, 0))).toContain('🚫 本期報名已全面截止')
      expect(html(st(-D, 1000))).toContain('role="timer"')
    })
    it('沒有設定報名期間時不顯示面板；只設截止時間也能倒數', () => {
      expect(html(st(null, null))).toBe('')
      expect(html(st(null, 5 * D))).toContain('🔥 距離報名截止剩餘：')
    })
  })
  it('倒數歸零後：前台所有「報名」按鈕鎖定、顯示已截止（不需重新整理）', () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    const html = wrap(<FrontPage students={[s1]} camps={[camp]} regs={[]} loggedInStudentId="10101"
      settings={{ id: 'default', term_name: 'T', registration_start_at: new Date(Date.now() - 86400_000).toISOString(), registration_end_at: past, global_alert_message: '', global_alert_active: false }}
      getProfile={id => ({ ...emptyProfileView(id), emergency_contacts: [{ name: '王小美', relation: '母', phone: '0912345678', is_primary: true }] })}
      onLogin={async () => ({ ok: true })} onLogout={() => {}} onEnroll={noop} onResetPassword={async () => ({ success: true, message: '' })} />)
    expect(html).toContain('🚫 本期報名已全面截止')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>報名已截止<\/button>/)
  })
  it('忘記密碼面板：新密碼為選填，留空＝重設為預設密碼', () => {
    const h = wrap(<ForgotPasswordPanel onReset={async () => ({ success: true, message: '' })} />)
    expect(h).toContain('新密碼（選填）'); expect(h).toContain('留空＝重設回預設密碼')
  })
})
