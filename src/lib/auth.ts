import { EmergencyContact, StudentProfileView } from '../types'

export const MAX_FAILED_ATTEMPTS = 5
export const ADMIN_SESSION_KEY = 'camp_admin_auth'
export const ADMIN_TOKEN_KEY = 'camp_admin_token'
/** 僅供單元測試／顯示用的空視圖（不含密碼） */
export function emptyProfileView(studentId: string): StudentProfileView {
  return {
    student_id: studentId,
    failed_attempts: 0,
    is_locked: false,
    emergency_contacts: [],
  }
}

export function hasValidEmergencyContacts(profile?: StudentProfileView | null): boolean {
  const list = profile?.emergency_contacts ?? []
  return list.some(c => c.name.trim() && c.phone.trim())
}

export function primaryContact(profile?: StudentProfileView | null) {
  const list = profile?.emergency_contacts ?? []
  return list.find(c => c.is_primary && c.name.trim() && c.phone.trim())
    ?? list.find(c => c.name.trim() && c.phone.trim())
    ?? null
}

export function formatContactLine(profile?: StudentProfileView | null): string {
  const c = primaryContact(profile)
  if (!c) return '—'
  return `${c.name} (${c.phone})`
}

export function readAdminSession(): boolean {
  try { return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1' } catch { return false }
}

/** 將管理員於登入時輸入的密碼暫存於 session（非原始碼硬編碼），供後續 RPC 二次核驗 */
export function writeAdminSession(ok: boolean, adminPassword?: string) {
  try {
    if (ok && adminPassword) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, '1')
      sessionStorage.setItem(ADMIN_TOKEN_KEY, adminPassword)
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_KEY)
      sessionStorage.removeItem(ADMIN_TOKEN_KEY)
    }
  } catch { /* ignore */ }
}

export function readAdminToken(): string | null {
  try { return sessionStorage.getItem(ADMIN_TOKEN_KEY) } catch { return null }
}

export type ContactList = EmergencyContact[]
