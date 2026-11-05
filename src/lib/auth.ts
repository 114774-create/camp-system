import { StudentProfile } from '../types'

export const DEFAULT_ADMIN_PASSWORD = '2026'
export const MAX_FAILED_ATTEMPTS = 5
export const ADMIN_SESSION_KEY = 'camp_admin_auth'

export function defaultPassword(studentId: string) {
  return studentId
}

export function defaultProfile(studentId: string): StudentProfile {
  return {
    student_id: studentId,
    password_hash: defaultPassword(studentId),
    failed_attempts: 0,
    is_locked: false,
    emergency_contacts: [],
  }
}

export type LoginResult =
  | { ok: true }
  | { ok: false; locked: boolean; attempts: number; message: string }

/** 驗證學生密碼；失敗累計，達 5 次鎖定。回傳需持久化的 profile */
export function attemptStudentLogin(profile: StudentProfile, password: string): {
  result: LoginResult
  profile: StudentProfile
} {
  if (profile.is_locked) {
    return {
      result: {
        ok: false,
        locked: true,
        attempts: profile.failed_attempts,
        message: '密碼錯誤已達 5 次，帳號已鎖定，請聯繫學校行政人員由後台解鎖',
      },
      profile,
    }
  }
  if (password === profile.password_hash) {
    const okProfile = { ...profile, failed_attempts: 0 }
    return { result: { ok: true }, profile: okProfile }
  }
  const attempts = profile.failed_attempts + 1
  const locked = attempts >= MAX_FAILED_ATTEMPTS
  const next = { ...profile, failed_attempts: attempts, is_locked: locked }
  return {
    result: {
      ok: false,
      locked,
      attempts,
      message: locked
        ? '密碼錯誤已達 5 次，帳號已鎖定，請聯繫學校行政人員由後台解鎖'
        : `密碼錯誤（尚可嘗試 ${MAX_FAILED_ATTEMPTS - attempts} 次）`,
    },
    profile: next,
  }
}

export function unlockAndResetPassword(profile: StudentProfile): StudentProfile {
  return {
    ...profile,
    is_locked: false,
    failed_attempts: 0,
    password_hash: defaultPassword(profile.student_id),
  }
}

export function hasValidEmergencyContacts(profile?: StudentProfile | null): boolean {
  const list = profile?.emergency_contacts ?? []
  return list.some(c => c.name.trim() && c.phone.trim())
}

export function primaryContact(profile?: StudentProfile | null) {
  const list = profile?.emergency_contacts ?? []
  return list.find(c => c.is_primary && c.name.trim() && c.phone.trim())
    ?? list.find(c => c.name.trim() && c.phone.trim())
    ?? null
}

export function formatContactLine(profile?: StudentProfile | null): string {
  const c = primaryContact(profile)
  if (!c) return '—'
  return `${c.name} (${c.phone})`
}

export function readAdminSession(): boolean {
  try { return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1' } catch { return false }
}

export function writeAdminSession(ok: boolean) {
  try {
    if (ok) sessionStorage.setItem(ADMIN_SESSION_KEY, '1')
    else sessionStorage.removeItem(ADMIN_SESSION_KEY)
  } catch { /* ignore */ }
}
