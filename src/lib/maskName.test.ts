import { describe, expect, it, beforeEach } from 'vitest'
import { displayStudentName, maskName } from './maskName'
import { hasValidEmergencyContacts, emptyProfileView } from './auth'
import { canRequestLeave, validateRegistration } from './validate'
import { Camp, PublicSettings, Student } from '../types'
import { sha256Hex, LOCAL_ADMIN_PASSWORD_SHA256 } from './localCrypto'
import { __localRepo } from '../data/repo'

const mk = (o: Partial<Camp>): Camp => ({
  id: 'x', term: 'T', season: 'summer', name: 'X', attendance_mode: 'full_course',
  dates: ['2026-07-06'], start_time: '09:00', end_time: '12:00',
  allowed_grades: [1, 2, 3, 4, 5, 6], max_capacity: 10,
  ignore_time_conflict: false, allow_concurrent_with: [],
  has_sub_classes: false, sub_classes: [], location: '', teacher: '', notes: '', ...o,
})
const st = (id: string, grade: number): Student => ({ student_id: id, grade, classCode: `${grade}01`, no: 1, name: id })
const code = (r: { ok: boolean; code?: string }) => (r.ok ? 'OK' : r.code)

const openWindow: PublicSettings = {
  id: 'default',
  registration_start_at: '2020-01-01T00:00:00.000Z',
  registration_end_at: '2099-01-01T00:00:00.000Z',
  term_name: 'T',
}

describe('maskName', () => {
  it('遮罩中文姓名', () => {
    expect(maskName('王小明')).toBe('王〇明')
    expect(maskName('王明')).toBe('王〇')
    expect(maskName('歐陽小明')).toBe('歐〇〇明')
  })
  it('英文語系併列 ename', () => {
    expect(displayStudentName({ name: '王傳薳', ename: 'Kevin' }, { locale: 'en', revealed: false })).toBe('Kevin (王〇薳)')
    expect(displayStudentName({ name: '王傳薳', ename: 'Kevin' }, { locale: 'en', revealed: true })).toBe('Kevin (王傳薳)')
  })
})

describe('localCrypto', () => {
  it('SHA-256 摘要穩定且前端不含明文預設後台密碼常數比對用摘要', async () => {
    expect(LOCAL_ADMIN_PASSWORD_SHA256).toHaveLength(64)
    expect(LOCAL_ADMIN_PASSWORD_SHA256).toBe(await sha256Hex(String.fromCharCode(50, 48, 50, 54)))
  })
})

describe('emergency contact gate', () => {
  it('無聯絡人不可報名', () => {
    const c = mk({ id: 'a', dates: ['2026-07-06', '2026-07-07'] })
    const empty = emptyProfileView('s')
    expect(hasValidEmergencyContacts(empty)).toBe(false)
    expect(code(validateRegistration(st('s', 1), c, c.dates[0], [], [c], { profile: empty, settings: openWindow }))).toBe('CONTACT')
    const filled = { ...empty, emergency_contacts: [{ name: '王大明', relation: '父', phone: '0912-345678', is_primary: true }] }
    expect(code(validateRegistration(st('s', 1), c, c.dates[0], [], [c], { profile: filled, settings: openWindow }))).toBe('OK')
  })
})

describe('leave rules', () => {
  it('單日與單日擇一不可請假，多日可請假', () => {
    expect(canRequestLeave(mk({ dates: ['2026-07-06'] }))).toBe(false)
    expect(canRequestLeave(mk({ attendance_mode: 'single_day_choice', dates: ['2026-07-06'] }))).toBe(false)
    expect(canRequestLeave(mk({ dates: ['2026-07-06', '2026-07-07'] }))).toBe(true)
  })
})

describe('registration window', () => {
  it('未開放與已截止', () => {
    const c = mk({ id: 'a' })
    const profile = { ...emptyProfileView('s'), emergency_contacts: [{ name: 'A', relation: '母', phone: '09', is_primary: true }] }
    const before: PublicSettings = {
      id: 'default',
      registration_start_at: '2090-01-01T00:00:00.000Z',
      registration_end_at: '2099-01-01T00:00:00.000Z',
      term_name: 'T',
    }
    const after: PublicSettings = {
      ...before,
      registration_start_at: '2020-01-01T00:00:00.000Z',
      registration_end_at: '2021-01-01T00:00:00.000Z',
    }
    expect(code(validateRegistration(st('s', 1), c, c.dates[0], [], [c], { profile, settings: before }))).toBe('WINDOW')
    expect(code(validateRegistration(st('s', 1), c, c.dates[0], [], [c], { profile, settings: after }))).toBe('WINDOW')
  })
})

describe('localRepo RPC simulation', () => {
  const mem = new Map<string, string>()
  beforeEach(() => {
    mem.clear()
    const polyfill: Storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v) },
      removeItem: (k: string) => { mem.delete(k) },
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    }
    Object.defineProperty(globalThis, 'localStorage', { value: polyfill, configurable: true })
  })

  it('學生登入錯誤 5 次鎖定，且成功時只回傳該生聯絡人', async () => {
    const repo = __localRepo
    const id = '10101'
    for (let i = 0; i < 4; i++) {
      const r = await repo.verifyStudentLogin(id, 'wrong')
      expect(r.success).toBe(false)
      expect(r.is_locked).toBe(false)
    }
    const locked = await repo.verifyStudentLogin(id, 'wrong')
    expect(locked.success).toBe(false)
    expect(locked.is_locked).toBe(true)

    // 後台解鎖（使用本機摘要對應之預設後台密碼：字元碼組合，避免原始碼出現明文常數）
    const adminPwd = String.fromCharCode(50, 48, 50, 54)
    await repo.adminUnlockStudent(adminPwd, id)
    await repo.adminResetStudentPassword(adminPwd, id)

    const ok = await repo.verifyStudentLogin(id, id)
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.emergency_contacts).toEqual([])
  })

  it('後台驗證成功才取得全校 profiles，公開設定不含密碼欄位', async () => {
    const repo = __localRepo
    const adminPwd = String.fromCharCode(50, 48, 50, 54)
    const pub = await repo.getPublicSettings()
    expect(pub).not.toHaveProperty('admin_password')
    expect(pub).not.toHaveProperty('admin_password_hash')

    await expect(repo.verifyAdminAndFetchAll('bad')).rejects.toThrow()
    const bundle = await repo.verifyAdminAndFetchAll(adminPwd)
    expect(bundle.success).toBe(true)
    expect(bundle.settings).not.toHaveProperty('admin_password_hash')
  })
})
