import { describe, expect, it } from 'vitest'
import { displayStudentName, maskName } from './maskName'
import { attemptStudentLogin, hasValidEmergencyContacts, unlockAndResetPassword, defaultProfile } from './auth'
import { canRequestLeave, validateRegistration } from './validate'
import { Camp, Registration, Student, SystemSettings } from '../types'

const mk = (o: Partial<Camp>): Camp => ({
  id: 'x', term: 'T', season: 'summer', name: 'X', attendance_mode: 'full_course',
  dates: ['2026-07-06'], start_time: '09:00', end_time: '12:00',
  allowed_grades: [1, 2, 3, 4, 5, 6], max_capacity: 10,
  ignore_time_conflict: false, allow_concurrent_with: [],
  has_sub_classes: false, sub_classes: [], location: '', teacher: '', notes: '', ...o,
})
const st = (id: string, grade: number): Student => ({ student_id: id, grade, classCode: `${grade}01`, no: 1, name: id })
const reg = (sid: string, cid: string, status: 'enrolled' | 'cancelled' = 'enrolled'): Registration =>
  ({ id: sid + cid, student_id: sid, camp_id: cid, status, created_at: '', leave_dates: [] })
const code = (r: { ok: boolean; code?: string }) => (r.ok ? 'OK' : r.code)

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

describe('student login lock', () => {
  it('連續錯誤 5 次鎖定', () => {
    let p = defaultProfile('10101')
    for (let i = 0; i < 4; i++) {
      const { result, profile } = attemptStudentLogin(p, 'wrong')
      expect(result.ok).toBe(false)
      expect(profile.is_locked).toBe(false)
      p = profile
    }
    const last = attemptStudentLogin(p, 'wrong')
    expect(last.result.ok).toBe(false)
    expect(last.profile.is_locked).toBe(true)
    expect(last.result.ok === false && last.result.message).toContain('帳號已鎖定')
    const unlocked = unlockAndResetPassword(last.profile)
    expect(unlocked.is_locked).toBe(false)
    expect(unlocked.password_hash).toBe('10101')
  })
})

describe('emergency contact gate', () => {
  it('無聯絡人不可報名', () => {
    const c = mk({ id: 'a', dates: ['2026-07-06', '2026-07-07'] })
    const settings: SystemSettings = {
      id: 'default', admin_password: '2026',
      registration_start_at: '2020-01-01T00:00:00.000Z',
      registration_end_at: '2099-01-01T00:00:00.000Z',
      term_name: 'T',
    }
    const empty = defaultProfile('s')
    expect(hasValidEmergencyContacts(empty)).toBe(false)
    expect(code(validateRegistration(st('s', 1), c, c.dates[0], [], [c], { profile: empty, settings }))).toBe('CONTACT')
    const filled = { ...empty, emergency_contacts: [{ name: '王大明', relation: '父', phone: '0912-345678', is_primary: true }] }
    expect(code(validateRegistration(st('s', 1), c, c.dates[0], [], [c], { profile: filled, settings }))).toBe('OK')
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
    const profile = { ...defaultProfile('s'), emergency_contacts: [{ name: 'A', relation: '母', phone: '09', is_primary: true }] }
    const before: SystemSettings = {
      id: 'default', admin_password: '2026',
      registration_start_at: '2090-01-01T00:00:00.000Z',
      registration_end_at: '2099-01-01T00:00:00.000Z',
      term_name: 'T',
    }
    const after: SystemSettings = {
      ...before,
      registration_start_at: '2020-01-01T00:00:00.000Z',
      registration_end_at: '2021-01-01T00:00:00.000Z',
    }
    expect(code(validateRegistration(st('s', 1), c, c.dates[0], [], [c], { profile, settings: before }))).toBe('WINDOW')
    expect(code(validateRegistration(st('s', 1), c, c.dates[0], [], [c], { profile, settings: after }))).toBe('WINDOW')
  })
})
