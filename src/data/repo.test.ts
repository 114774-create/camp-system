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
const setup = async (id: string, contacts?: EmergencyContact[]) => {
  await repo.verifyStudentLogin(id, id)
  if (contacts) await repo.updateStudentProfile(id, id, null, contacts)
}

describe('忘記密碼：學號 + 主要聯絡人電話', () => {
  it('電話相符 → 解鎖、歸零、改密碼；舊密碼失效', async () => {
    await setup('10101', [contact('0912-345678')])
    for (let i = 0; i < 5; i++) await repo.verifyStudentLogin('10101', 'bad')      // 鎖定
    expect((await repo.verifyStudentLogin('10101', '10101')).success).toBe(false)
    const r = await repo.resetPasswordByPhone('10101', '0912345678', 'newpass')
    expect(r.success).toBe(true)
    expect((await repo.verifyStudentLogin('10101', 'newpass')).success).toBe(true)
    expect((await repo.verifyStudentLogin('10101', '10101')).success).toBe(false)
  })
  it('只比對「主要」聯絡人；電話不符一律回傳相同訊息（不洩漏學號是否存在）', async () => {
    await setup('10101', [{ ...contact('0911111111', '次要'), is_primary: false }, contact('0922222222')])
    expect((await repo.resetPasswordByPhone('10101', '0911111111', 'newpass')).success).toBe(false)
    expect((await repo.resetPasswordByPhone('10101', '0922222222', 'newpass')).success).toBe(true)
    const a = await repo.resetPasswordByPhone('10101', '0900000000', 'newpass')
    const b = await repo.resetPasswordByPhone('99999', '0900000000', 'newpass')
    expect(a.message).toBe(b.message)
  })
  it('防暴力：連續錯 5 次暫停，之後即使電話正確也被擋', async () => {
    await setup('10101', [contact()])
    for (let i = 0; i < 5; i++) expect((await repo.resetPasswordByPhone('10101', '0900000000', 'newpass')).success).toBe(false)
    const r = await repo.resetPasswordByPhone('10101', '0912345678', 'newpass')
    expect(r.success).toBe(false); expect(r.locked).toBe(true)
  })
  it('沒有聯絡人、或新密碼太短 → 失敗', async () => {
    await setup('10101')
    expect((await repo.resetPasswordByPhone('10101', '0912345678', 'newpass')).success).toBe(false)
    await setup('10102', [contact()])
    expect((await repo.resetPasswordByPhone('10102', '0912345678', 'abc')).success).toBe(false)
  })
})

describe('手足綁定與聯絡人自動同步', () => {
  it('B 沒有聯絡人 → 複製 A 的聯絡人給 B', async () => {
    await setup('10101', [contact()]); await setup('10102')
    const r = await repo.bindSibling({ id: '10101', password: '10101' }, { id: '10102', password: '10102' })
    expect(r).toMatchObject({ success: true, copied: true })
    expect((await repo.verifyStudentLogin('10102', '10102') as any).emergency_contacts).toEqual([contact()])
  })
  it('B 已有聯絡人 → 不覆蓋', async () => {
    await setup('10101', [contact()]); await setup('10102', [contact('0933333333', '李小華')])
    const r = await repo.bindSibling({ id: '10101', password: '10101' }, { id: '10102', password: '10102' })
    expect(r).toMatchObject({ success: true, copied: false })
    expect((r as any).emergency_contacts[0].name).toBe('李小華')
  })
  it('A 也沒有聯絡人 → 綁定成功但不複製', async () => {
    await setup('10101'); await setup('10102')
    expect(await repo.bindSibling({ id: '10101', password: '10101' }, { id: '10102', password: '10102' })).toMatchObject({ success: true, copied: false })
  })
  it('B 密碼錯誤 → 失敗（標示 B）且不複製；同一帳號不可綁自己', async () => {
    await setup('10101', [contact()]); await setup('10102')
    const r = await repo.bindSibling({ id: '10101', password: '10101' }, { id: '10102', password: 'wrong' })
    expect(r).toMatchObject({ success: false, who: 'B' })
    expect((await repo.verifyStudentLogin('10102', '10102') as any).emergency_contacts).toEqual([])
    expect((await repo.bindSibling({ id: '10101', password: '10101' }, { id: '10101', password: '10101' })).success).toBe(false)
  })
})

describe('教師數位點名簿', () => {
  const seedCamp = async (pin = '1234') => {
    await repo.adminSaveCamp(ADMIN, camp({ teacher_pin: pin }))
    await repo.upsertRegs([{ id: 'r1', student_id: '30101', camp_id: 'c1', status: 'enrolled', created_at: '2026-07-01T00:00:00Z', leave_dates: ['2026-12-12'] },
      { id: 'r2', student_id: '30102', camp_id: 'c1', status: 'waitlisted', created_at: '2026-07-02T00:00:00Z' }])
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
    expect(ok.success && ok.roster.map(r => r.student_id)).toEqual(['30101'])
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
    expect((await repo.teacherMark('c1', '1234', '30101', '2026-12-05', 'present')).success).toBe(true)
    let r = await repo.teacherRoster('c1', '1234'); expect(r.success && r.marks).toEqual([{ student_id: '30101', date: '2026-12-05', status: 'present' }])
    await repo.teacherMark('c1', '1234', '30101', '2026-12-05', 'absent')
    r = await repo.teacherRoster('c1', '1234'); expect(r.success && r.marks[0].status).toBe('absent')
    await repo.teacherMark('c1', '1234', '30101', '2026-12-05', null)
    r = await repo.teacherRoster('c1', '1234'); expect(r.success && r.marks).toEqual([])
    expect((await repo.teacherMark('c1', '1234', '30101', '2026-12-06', 'present')).success).toBe(false)
    expect((await repo.teacherMark('c1', '1234', '30102', '2026-12-05', 'present')).success).toBe(false)  // 候補不在名單
    expect((await repo.teacherMark('c1', '9999', '30101', '2026-12-05', 'present')).success).toBe(false)
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
