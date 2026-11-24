// 本機 repo（與 schema.sql 行為對應）：密碼重設、手足聯絡人同步、教師 PIN／點名、公告設定
import { beforeEach, describe, expect, it } from 'vitest'
import { __localRepo as repo } from './repo'
import { Camp, EmergencyContact } from '../types'

class Mem { m = new Map<string, string>()
  get length() { return this.m.size } key(i: number) { return [...this.m.keys()][i] ?? null }
  getItem(k: string) { return this.m.get(k) ?? null } setItem(k: string, v: string) { this.m.set(k, v) } removeItem(k: string) { this.m.delete(k) } }
beforeEach(() => { Object.defineProperty(globalThis, 'localStorage', { value: new Mem(), configurable: true, writable: true }) })

const ADMIN = '2026'
const contact = (phone = '0912345678', name = '王大明'): EmergencyContact => ({ name, relation: '父', phone, is_primary: true })
const camp = (o: Partial<Camp> = {}): Camp => ({ id: 'c1', term: '115學年度夏令營', season: 'summer', name: '籃球營', attendance_mode: 'full_course', dates: ['2026-12-05', '2026-12-12'], start_time: '08:30', end_time: '11:30', allowed_grades: [3, 4, 5], max_capacity: 30, ignore_time_conflict: false, allow_concurrent_with: [], has_sub_classes: false, sub_classes: [], location: '', teacher: '', notes: '', ...o })
// 學生以「姓名」為鍵；學號只用於首次登入（預設密碼）
const N: Record<string, string> = { '10101': '王小明', '10102': '李小華', '99999': '查無此人' }
const setup = async (id: string, contacts?: EmergencyContact[]) => {
  await repo.verifyStudentLogin(N[id], id, id)
  if (contacts) await repo.updateStudentProfile(N[id], id, null, contacts, id)
}

describe('忘記密碼：學號 + 主要聯絡人電話', () => {
  it('電話相符 → 解鎖、歸零、改密碼；舊密碼失效', async () => {
    await setup('10101', [contact('0912-345678')])
    for (let i = 0; i < 5; i++) await repo.verifyStudentLogin(N['10101'], 'bad', '10101')      // 鎖定
    expect((await repo.verifyStudentLogin(N['10101'], '10101', '10101')).success).toBe(false)
    const r = await repo.resetPasswordByPhone(N['10101'], '0912345678', 'newpass')
    expect(r.success).toBe(true)
    expect((await repo.verifyStudentLogin(N['10101'], 'newpass', '10101')).success).toBe(true)
    expect((await repo.verifyStudentLogin(N['10101'], '10101', '10101')).success).toBe(false)
  })
  it('只比對「主要」聯絡人；電話不符一律回傳相同訊息（不洩漏學號是否存在）', async () => {
    await setup('10101', [{ ...contact('0911111111', '次要'), is_primary: false }, contact('0922222222')])
    expect((await repo.resetPasswordByPhone(N['10101'], '0911111111', 'newpass')).success).toBe(false)
    expect((await repo.resetPasswordByPhone(N['10101'], '0922222222', 'newpass')).success).toBe(true)
    const a = await repo.resetPasswordByPhone(N['10101'], '0900000000', 'newpass')
    const b = await repo.resetPasswordByPhone(N['99999'], '0900000000', 'newpass')
    expect(a.message).toBe(b.message)
  })
  it('防暴力：連續錯 5 次暫停，之後即使電話正確也被擋', async () => {
    await setup('10101', [contact()])
    for (let i = 0; i < 5; i++) expect((await repo.resetPasswordByPhone(N['10101'], '0900000000', 'newpass')).success).toBe(false)
    const r = await repo.resetPasswordByPhone(N['10101'], '0912345678', 'newpass')
    expect(r.success).toBe(false); expect(r.locked).toBe(true)
  })
  it('沒有聯絡人、或新密碼太短 → 失敗', async () => {
    await setup('10101')
    expect((await repo.resetPasswordByPhone(N['10101'], '0912345678', 'newpass')).success).toBe(false)
    await setup('10102', [contact()])
    expect((await repo.resetPasswordByPhone(N['10102'], '0912345678', 'abc')).success).toBe(false)
  })
})

describe('手足綁定與聯絡人自動同步', () => {
  it('B 沒有聯絡人 → 複製 A 的聯絡人給 B', async () => {
    await setup('10101', [contact()]); await setup('10102')
    const r = await repo.bindSibling({ name: N['10101'], id: '10101', password: '10101' }, { name: N['10102'], id: '10102', password: '10102' })
    expect(r).toMatchObject({ success: true, copied: true })
    expect((await repo.verifyStudentLogin(N['10102'], '10102', '10102') as any).emergency_contacts).toEqual([contact()])
  })
  it('B 已有聯絡人 → 不覆蓋', async () => {
    await setup('10101', [contact()]); await setup('10102', [contact('0933333333', '李小華')])
    const r = await repo.bindSibling({ name: N['10101'], id: '10101', password: '10101' }, { name: N['10102'], id: '10102', password: '10102' })
    expect(r).toMatchObject({ success: true, copied: false })
    expect((r as any).emergency_contacts[0].name).toBe('李小華')
  })
  it('A 也沒有聯絡人 → 綁定成功但不複製', async () => {
    await setup('10101'); await setup('10102')
    expect(await repo.bindSibling({ name: N['10101'], id: '10101', password: '10101' }, { name: N['10102'], id: '10102', password: '10102' })).toMatchObject({ success: true, copied: false })
  })
  it('B 密碼錯誤 → 失敗（標示 B）且不複製；同一帳號不可綁自己', async () => {
    await setup('10101', [contact()]); await setup('10102')
    const r = await repo.bindSibling({ name: N['10101'], id: '10101', password: '10101' }, { name: N['10102'], id: '10102', password: 'wrong' })
    expect(r).toMatchObject({ success: false, who: 'B' })
    expect((await repo.verifyStudentLogin(N['10102'], '10102', '10102') as any).emergency_contacts).toEqual([])
    expect((await repo.bindSibling({ name: N['10101'], id: '10101', password: '10101' }, { name: N['10101'], id: '10101', password: '10101' })).success).toBe(false)
  })
})

describe('教師數位點名簿', () => {
  const seedCamp = async (pin = '1234') => {
    await repo.adminSaveCamp(ADMIN, camp({ teacher_pin: pin }))
    await repo.upsertRegs([{ id: 'r1', student_name: '王大同', snapshot_student_id: '30101', camp_id: 'c1', status: 'enrolled', created_at: '2026-07-01T00:00:00Z', leave_dates: ['2026-12-12'] },
      { id: 'r2', student_name: '陳小美', snapshot_student_id: '30102', camp_id: 'c1', status: 'waitlisted', created_at: '2026-07-02T00:00:00Z' }])
  }
  it('PIN 不會出現在公開營隊資料，只有後台能取得', async () => {
    await seedCamp()
    expect(JSON.stringify(await repo.listCamps())).not.toContain('1234')
    expect((await repo.verifyAdminAndFetchAll(ADMIN)).teacher_pins).toMatchObject({ c1: '1234' })
    await expect(repo.verifyAdminAndFetchAll('bad')).rejects.toThrow()
  })
  it('PIN 正確 → 取得正取名單（不含候補）與請假；錯誤 → 失敗', async () => {
    await seedCamp()
    const ok = await repo.teacherRoster('c1', '1234')
    expect(ok.success && ok.roster.map(r => r.student_name)).toEqual(['王大同'])
    expect(ok.success && ok.roster[0].leave_dates).toEqual(['2026-12-12'])
    const bad = await repo.teacherRoster('c1', '0000'); expect(bad.success).toBe(false)
    expect((await repo.teacherRoster('nope', '1234')).success).toBe(false)
  })
  it('連續錯 8 次鎖定，之後正確 PIN 也被擋', async () => {
    await seedCamp()
    for (let i = 0; i < 8; i++) await repo.teacherRoster('c1', '0000')
    const r = await repo.teacherRoster('c1', '1234')
    expect(r.success).toBe(false); expect(!r.success && r.locked).toBe(true)
  })
  it('點名：簽到／缺席／撤銷，並擋下錯日期、非名單學生、錯 PIN', async () => {
    await seedCamp()
    expect((await repo.teacherMark('c1', '1234', '王大同', '2026-12-05', 'present')).success).toBe(true)
    let r = await repo.teacherRoster('c1', '1234'); expect(r.success && r.marks).toEqual([{ student_name: '王大同', date: '2026-12-05', status: 'present' }])
    await repo.teacherMark('c1', '1234', '王大同', '2026-12-05', 'absent')
    r = await repo.teacherRoster('c1', '1234'); expect(r.success && r.marks[0].status).toBe('absent')
    await repo.teacherMark('c1', '1234', '王大同', '2026-12-05', null)
    r = await repo.teacherRoster('c1', '1234'); expect(r.success && r.marks).toEqual([])
    expect((await repo.teacherMark('c1', '1234', '王大同', '2026-12-06', 'present')).success).toBe(false)
    expect((await repo.teacherMark('c1', '1234', '陳小美', '2026-12-05', 'present')).success).toBe(false)  // 候補不在名單
    expect((await repo.teacherMark('c1', '9999', '王大同', '2026-12-05', 'present')).success).toBe(false)
  })
  it('儲存營隊時 PIN 格式錯誤會被拒絕；刪除營隊一併清除 PIN', async () => {
    await expect(repo.adminSaveCamp(ADMIN, camp({ teacher_pin: '12' }))).rejects.toThrow()
    await seedCamp(); await repo.adminDeleteCamp(ADMIN, 'c1')
    expect((await repo.teacherRoster('c1', '1234')).success).toBe(false)
  })
})

describe('全站緊急公告設定', () => {
  it('管理員可啟用／編輯，公開設定讀得到；非管理員不可改', async () => {
    expect(await repo.getPublicSettings()).toMatchObject({ global_alert_active: false, global_alert_message: '' })
    const base = { term_name: 'T', registration_start_at: '2026-01-01T00:00:00Z', registration_end_at: '2026-12-31T00:00:00Z' }
    const s = await repo.adminSaveSettings(ADMIN, { ...base, global_alert_message: '因颱風停課', global_alert_active: true })
    expect(s).toMatchObject({ global_alert_active: true, global_alert_message: '因颱風停課' })
    expect(await repo.getPublicSettings()).toMatchObject({ global_alert_active: true })
    await expect(repo.adminSaveSettings('bad', base)).rejects.toThrow()
    expect((await repo.adminSaveSettings(ADMIN, { ...base, global_alert_active: false })).global_alert_message).toBe('因颱風停課')  // 只關閉、保留文字
  })
})

describe('v5：以姓名為鍵（學號每年會變）', () => {
  it('升年級（學號 10101 → 20101）：同姓名仍是同一個帳號，密碼與聯絡人都保留', async () => {
    await setup('10101', [contact()])
    await repo.updateStudentProfile('王小明', '10101', 'mypass', null, '10101')        // 家長改了密碼
    const next = await repo.verifyStudentLogin('王小明', 'mypass', '20101')          // 隔年用新學號登入
    expect(next.success).toBe(true)
    expect(next.success && next.emergency_contacts).toEqual([contact()])
  })
  it('學號被新同學沿用（20101）：新同學是另一個姓名 → 全新帳號，看不到前一位的資料', async () => {
    await setup('10101', [contact()])
    await repo.updateStudentProfile('王小明', '10101', 'mypass', null, '10101')
    const fresh = await repo.verifyStudentLogin('李小華', '20101', '20101')            // 新同學：預設密碼＝新學號
    expect(fresh).toMatchObject({ success: true, emergency_contacts: [] })
    expect((await repo.verifyStudentLogin('李小華', 'mypass', '20101')).success).toBe(false)   // 前一位的密碼進不去
  })
  it('姓名比對前一律去除全形／半形空白、Tab、NBSP', async () => {
    await setup('10101', [contact()])
    for (const v of ['王 小明', '王　小　明', ' 王小明 ', '王\u00a0小\t明']) {
      const r = await repo.verifyStudentLogin(v, '10101', '10101')
      expect(r.success && r.emergency_contacts.length).toBe(1)
    }
    expect(JSON.stringify((await repo.verifyAdminAndFetchAll(ADMIN)).profiles)).toContain('"student_name":"王小明"')
  })
  it('名單驗證：名單同步後，學號與姓名不相符就不能首次建立帳號（防搶註冊）', async () => {
    await repo.adminSyncRoster(ADMIN, [{ student_id: '10101', student_name: '王 小明' }, { student_id: '10102', student_name: '李小華' }])
    // 攻擊者對還沒登入過的「王小明」，送出自己編的學號當密碼
    const spoof = await repo.verifyStudentLogin('王小明', '55555', '55555')
    expect(spoof.success).toBe(false)
    expect((await repo.verifyAdminAndFetchAll(ADMIN)).profiles).toHaveLength(0)       // 被拒絕的嘗試不會留下任何帳號
    expect((await repo.verifyStudentLogin('不在名單', '10101', '10101')).success).toBe(false)
    expect((await repo.verifyStudentLogin('王小明', '10102', '10102')).success).toBe(false)   // 學號屬於別人
    expect((await repo.verifyStudentLogin('王小明', '10101', '10101')).success).toBe(true)    // 真正的學號＋姓名
  })
  it('同名同姓：名單同步會回報重複，且這些學生一律拒絕登入／重設／綁定', async () => {
    const r = await repo.adminSyncRoster(ADMIN, [{ student_id: '10101', student_name: '王小明' }, { student_id: '20101', student_name: '王小明' }, { student_id: '10102', student_name: '李小華' }])
    expect(r).toEqual({ count: 3, duplicates: ['王小明'] })
    expect((await repo.verifyStudentLogin('王小明', '10101', '10101')).success).toBe(false)
    expect((await repo.resetPasswordByPhone('王小明', '0912345678', 'newpass')).success).toBe(false)
    expect((await repo.verifyStudentLogin('李小華', '10102', '10102')).success).toBe(true)
  })
  it('後台「重設密碼」＝重設為目前的學號；舊學號不再有效', async () => {
    await setup('10101', [contact()])
    await repo.adminResetStudentPassword(ADMIN, '王小明', '20101')
    expect((await repo.verifyStudentLogin('王小明', '10101', '20101')).success).toBe(false)
    expect((await repo.verifyStudentLogin('王小明', '20101', '20101')).success).toBe(true)
    await expect(repo.adminResetStudentPassword('bad', '王小明', '20101')).rejects.toThrow()
  })
  it('名單同步僅限管理員；後台代為設定聯絡人以姓名為鍵', async () => {
    await expect(repo.adminSyncRoster('bad', [])).rejects.toThrow()
    await repo.adminSetContacts(ADMIN, '王 小明', [contact()], '10101')
    expect((await repo.verifyStudentLogin('王小明', '10101', '10101') as any).emergency_contacts).toEqual([contact()])
  })
})

describe('v6：預設密碼跟著目前學號；報名跟著姓名', () => {
  const sync = (id: string, name = '王小明') => repo.adminSyncRoster(ADMIN, [{ student_id: id, student_name: name }])
  const login = (pwd: string, id: string, name = '王小明') => repo.verifyStudentLogin(name, pwd, id)

  it('沒改過密碼：升年級後「新學號」自動可用，舊學號失效', async () => {
    await sync('10101')
    expect((await login('10101', '10101')).success).toBe(true)
    await sync('20101')                                           // 隔年試算表更新、管理員登入同步
    expect((await login('20101', '20101')).success).toBe(true)    // 密碼自動變成 20101
    expect((await login('10101', '20101')).success).toBe(false)   // 舊學號不能再當密碼
  })
  it('已自訂密碼：維持自訂密碼，新學號不能當密碼', async () => {
    await sync('10101'); await login('10101', '10101')
    await repo.updateStudentProfile('王小明', '10101', 'mypass', null, '10101')
    await sync('20101')
    expect((await login('mypass', '20101')).success).toBe(true)
    expect((await login('20101', '20101')).success).toBe(false)
  })
  it('防偽造：沒改過密碼的帳號，傳不在名單裡的學號當密碼會被拒絕，而且不計入錯誤次數', async () => {
    await sync('20101'); await login('20101', '20101')
    for (let i = 0; i < 8; i++) expect((await login('99999', '99999')).success).toBe(false)   // 攻擊者編學號，密碼也填同一個
    expect((await login('20101', '20101')).success).toBe(true)     // 沒被鎖，本人仍可登入
  })
  it('管理員重設密碼：回到預設（目前學號），自訂密碼失效', async () => {
    await sync('10101'); await login('10101', '10101')
    await repo.updateStudentProfile('王小明', '10101', 'mypass', null, '10101')
    await sync('20101')
    await repo.adminResetStudentPassword(ADMIN, '王小明', '20101')
    expect((await login('mypass', '20101')).success).toBe(false)
    expect((await login('20101', '20101')).success).toBe(true)
  })
  it('電話忘記密碼：新密碼留空＝回到預設；有填＝自訂', async () => {
    await sync('20101'); await login('20101', '20101')
    await repo.updateStudentProfile('王小明', '20101', 'mypass', [contact()], '20101')
    const toDefault = await repo.resetPasswordByPhone('王小明', '0912345678', null, '20101')
    expect(toDefault.success).toBe(true)
    expect((await login('mypass', '20101')).success).toBe(false)
    expect((await login('20101', '20101')).success).toBe(true)
    const custom = await repo.resetPasswordByPhone('王小明', '0912345678', 'newpass', '20101')
    expect(custom.success).toBe(true)
    expect((await login('newpass', '20101')).success).toBe(true)
    expect((await login('20101', '20101')).success).toBe(false)
    expect((await repo.resetPasswordByPhone('王小明', '0912345678', 'abc', '20101')).success).toBe(false)   // 自訂至少 4 碼
  })
  it('舊資料（沒有 has_custom_password 欄位）保守視為已自訂，不會被當成預設密碼', async () => {
    const { sha256Hex } = await import('../lib/localCrypto')
    localStorage.setItem('camp_profiles_by_name', JSON.stringify([{ student_name: '王小明', password_hash: await sha256Hex('secret'), failed_attempts: 0, is_locked: false, emergency_contacts: [] }]))
    expect((await login('secret', '10101')).success).toBe(true)
    expect((await login('10101', '10101')).success).toBe(false)
  })
})

describe('v6：報名紀錄跟著姓名走', () => {
  const regOf = (name: string, snap: string) => ({ id: 'r-' + name, student_name: name, snapshot_student_id: snap, camp_id: 'c1', status: 'enrolled' as const, created_at: '2026-07-01T00:00:00Z' })
  it('升年級後（學號 10101 → 20101）仍以姓名查到自己的歷史紀錄，快照學號原樣保留', async () => {
    await repo.adminSaveCamp(ADMIN, camp({ teacher_pin: '1234' }))
    await repo.upsertRegs([regOf('王小明', '10101'), regOf('李小華', '10102')])
    const mine = (await repo.listRegs()).filter(r => r.student_name === '王小明')
    expect(mine).toHaveLength(1); expect(mine[0].snapshot_student_id).toBe('10101')
    expect((await repo.listRegs()).filter(r => r.student_name === '陳新生')).toEqual([])   // 學號被沿用的新同學：以姓名過濾，看不到別人的
    await repo.upsertRegs([{ ...mine[0], status: 'cancelled', cancelled_at: '2026-07-02T00:00:00Z' }])
    expect((await repo.listRegs()).find(r => r.id === 'r-王小明')).toMatchObject({ status: 'cancelled', snapshot_student_id: '10101' })
  })
  it('點名簿以姓名運作，學號變了也不影響', async () => {
    await repo.adminSaveCamp(ADMIN, camp({ teacher_pin: '1234' }))
    await repo.upsertRegs([regOf('王小明', '10101')])
    const r = await repo.teacherRoster('c1', '1234')
    expect(r.success && r.roster[0]).toMatchObject({ student_name: '王小明', snapshot_student_id: '10101' })
    expect((await repo.teacherMark('c1', '1234', '王 小明', '2026-12-05', 'present')).success).toBe(true)   // 空白也能對上
  })
})
