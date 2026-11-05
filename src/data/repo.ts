import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  Camp, EmergencyContact, PublicSettings, Registration,
  StudentLoginResult, StudentProfileView,
} from '../types'
import { DEFAULT_LOCAL_SETTINGS_STORE, DEFAULT_PUBLIC_SETTINGS, LocalSettingsStore, SEED } from './seed'
import { LOCAL_ADMIN_PASSWORD_SHA256, matchesLocalHash, sha256Hex } from '../lib/localCrypto'

export interface AdminBundle {
  success: true
  settings: PublicSettings
  profiles: StudentProfileView[]
}

export interface Repo {
  listCamps(): Promise<Camp[]>
  listRegs(): Promise<Registration[]>
  upsertRegs(r: Registration[]): Promise<void>

  getPublicSettings(): Promise<PublicSettings>
  verifyStudentLogin(studentId: string, password: string): Promise<StudentLoginResult>
  updateStudentProfile(
    studentId: string,
    currentPassword: string,
    newPassword: string | null,
    emergencyContacts: EmergencyContact[] | null,
  ): Promise<StudentLoginResult & { updated?: boolean }>

  verifyAdminAndFetchAll(adminPassword: string): Promise<AdminBundle>
  adminUnlockStudent(adminPassword: string, studentId: string): Promise<void>
  adminResetStudentPassword(adminPassword: string, studentId: string): Promise<void>
  adminSetContacts(adminPassword: string, studentId: string, contacts: EmergencyContact[]): Promise<void>
  adminSaveSettings(
    adminPassword: string,
    patch: { term_name: string; registration_start_at: string; registration_end_at: string; new_admin_password?: string },
  ): Promise<PublicSettings>
  adminSaveCamp(adminPassword: string, camp: Camp): Promise<void>
  adminDeleteCamp(adminPassword: string, campId: string): Promise<void>
}

// ─── localStorage 內部結構（含 hash，永不當作公開 API 回傳）───

interface LocalProfileRow {
  student_id: string
  password_hash: string
  failed_attempts: number
  is_locked: boolean
  emergency_contacts: EmergencyContact[]
}

const ls = <T,>(k: string, init: T): T => {
  try {
    const x = localStorage.getItem(k)
    return x ? JSON.parse(x) as T : init
  } catch {
    return init
  }
}

const saveLs = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v))

function toView(r: LocalProfileRow): StudentProfileView {
  return {
    student_id: r.student_id,
    failed_attempts: r.failed_attempts,
    is_locked: r.is_locked,
    emergency_contacts: r.emergency_contacts ?? [],
  }
}

function getLocalSettings(): LocalSettingsStore {
  const raw = ls<LocalSettingsStore | null>('camp_settings_secure', null)
  if (!raw?.admin_password_hash) return { ...DEFAULT_LOCAL_SETTINGS_STORE }
  return raw
}

function getLocalProfiles(): LocalProfileRow[] {
  return ls<LocalProfileRow[]>('camp_profiles_secure', [])
}

function saveLocalProfile(p: LocalProfileRow) {
  const list = getLocalProfiles()
  const next = list.some(x => x.student_id === p.student_id)
    ? list.map(x => x.student_id === p.student_id ? p : x)
    : [...list, p]
  saveLs('camp_profiles_secure', next)
}

async function localAssertAdmin(adminPassword: string) {
  const s = getLocalSettings()
  if (!(await matchesLocalHash(adminPassword, s.admin_password_hash || LOCAL_ADMIN_PASSWORD_SHA256))) {
    throw new Error('ADMIN_AUTH_FAILED')
  }
}

const localRepo: Repo = {
  async listCamps() { return ls('camp_camps', SEED) },
  async listRegs() {
    return ls<Registration[]>('camp_regs', []).map(r => ({ ...r, leave_dates: r.leave_dates ?? [] }))
  },
  async upsertRegs(rs) {
    const l = ls<Registration[]>('camp_regs', [])
    const m = new Map(l.map(x => [x.id, x]))
    rs.forEach(r => m.set(r.id, { ...r, leave_dates: r.leave_dates ?? [] }))
    saveLs('camp_regs', [...m.values()])
  },

  async getPublicSettings() {
    const s = getLocalSettings()
    return {
      id: s.id,
      term_name: s.term_name,
      registration_start_at: s.registration_start_at,
      registration_end_at: s.registration_end_at,
    }
  },

  async verifyStudentLogin(studentId, password) {
    const id = studentId.trim()
    let row = getLocalProfiles().find(p => p.student_id === id)

    if (!row) {
      if (password === id) {
        row = {
          student_id: id,
          password_hash: await sha256Hex(password),
          failed_attempts: 0,
          is_locked: false,
          emergency_contacts: [],
        }
        saveLocalProfile(row)
        return { success: true, is_locked: false, remaining_attempts: 5, emergency_contacts: [] }
      }
      row = {
        student_id: id,
        password_hash: await sha256Hex(id),
        failed_attempts: 1,
        is_locked: false,
        emergency_contacts: [],
      }
      saveLocalProfile(row)
      return { success: false, remaining_attempts: 4, is_locked: false, message: '密碼錯誤（尚可嘗試 4 次）' }
    }

    if (row.is_locked) {
      return {
        success: false, remaining_attempts: 0, is_locked: true,
        message: '密碼錯誤已達 5 次，帳號已鎖定，請聯繫學校行政人員由後台解鎖',
      }
    }

    if (await matchesLocalHash(password, row.password_hash)) {
      row = { ...row, failed_attempts: 0 }
      saveLocalProfile(row)
      return {
        success: true, is_locked: false, remaining_attempts: 5,
        emergency_contacts: row.emergency_contacts ?? [],
      }
    }

    const attempts = row.failed_attempts + 1
    const locked = attempts >= 5
    saveLocalProfile({ ...row, failed_attempts: attempts, is_locked: locked })
    return {
      success: false,
      remaining_attempts: Math.max(0, 5 - attempts),
      is_locked: locked,
      message: locked
        ? '密碼錯誤已達 5 次，帳號已鎖定，請聯繫學校行政人員由後台解鎖'
        : `密碼錯誤（尚可嘗試 ${5 - attempts} 次）`,
    }
  },

  async updateStudentProfile(studentId, currentPassword, newPassword, emergencyContacts) {
    const login = await this.verifyStudentLogin(studentId, currentPassword)
    if (!login.success) return { ...login, updated: false }
    let row = getLocalProfiles().find(p => p.student_id === studentId)!
    if (newPassword && newPassword.trim().length >= 4) {
      row = { ...row, password_hash: await sha256Hex(newPassword), failed_attempts: 0 }
    }
    if (emergencyContacts) {
      row = { ...row, emergency_contacts: emergencyContacts }
    }
    saveLocalProfile(row)
    return {
      success: true, is_locked: false, remaining_attempts: 5,
      emergency_contacts: row.emergency_contacts, updated: true,
    }
  },

  async verifyAdminAndFetchAll(adminPassword) {
    await localAssertAdmin(adminPassword)
    const s = await this.getPublicSettings()
    return {
      success: true as const,
      settings: s,
      profiles: getLocalProfiles().map(toView),
    }
  },

  async adminUnlockStudent(adminPassword, studentId) {
    await localAssertAdmin(adminPassword)
    const existing = getLocalProfiles().find(p => p.student_id === studentId)
    saveLocalProfile({
      student_id: studentId,
      password_hash: existing?.password_hash ?? await sha256Hex(studentId),
      failed_attempts: 0,
      is_locked: false,
      emergency_contacts: existing?.emergency_contacts ?? [],
    })
  },

  async adminResetStudentPassword(adminPassword, studentId) {
    await localAssertAdmin(adminPassword)
    const existing = getLocalProfiles().find(p => p.student_id === studentId)
    saveLocalProfile({
      student_id: studentId,
      password_hash: await sha256Hex(studentId),
      failed_attempts: 0,
      is_locked: false,
      emergency_contacts: existing?.emergency_contacts ?? [],
    })
  },

  async adminSetContacts(adminPassword, studentId, contacts) {
    await localAssertAdmin(adminPassword)
    const existing = getLocalProfiles().find(p => p.student_id === studentId)
    saveLocalProfile({
      student_id: studentId,
      password_hash: existing?.password_hash ?? await sha256Hex(studentId),
      failed_attempts: existing?.failed_attempts ?? 0,
      is_locked: existing?.is_locked ?? false,
      emergency_contacts: contacts,
    })
  },

  async adminSaveSettings(adminPassword, patch) {
    await localAssertAdmin(adminPassword)
    const cur = getLocalSettings()
    const next: LocalSettingsStore = {
      ...cur,
      term_name: patch.term_name,
      registration_start_at: patch.registration_start_at,
      registration_end_at: patch.registration_end_at,
      admin_password_hash: patch.new_admin_password && patch.new_admin_password.trim().length >= 4
        ? await sha256Hex(patch.new_admin_password)
        : cur.admin_password_hash,
    }
    saveLs('camp_settings_secure', next)
    return {
      id: next.id,
      term_name: next.term_name,
      registration_start_at: next.registration_start_at,
      registration_end_at: next.registration_end_at,
    }
  },

  async adminSaveCamp(adminPassword, camp) {
    await localAssertAdmin(adminPassword)
    const l = ls<Camp[]>('camp_camps', SEED)
    saveLs('camp_camps', l.some(x => x.id === camp.id) ? l.map(x => x.id === camp.id ? camp : x) : [...l, camp])
  },

  async adminDeleteCamp(adminPassword, campId) {
    await localAssertAdmin(adminPassword)
    saveLs('camp_camps', ls<Camp[]>('camp_camps', SEED).filter(x => x.id !== campId))
  },
}

// ─── Supabase RPC ─────────────────────────────────────────

function rpcError(error: { message?: string } | null): never {
  throw new Error(error?.message || 'RPC_FAILED')
}

function mapPublicSettings(raw: any): PublicSettings {
  return {
    id: raw?.id ?? 'default',
    term_name: raw?.term_name ?? DEFAULT_PUBLIC_SETTINGS.term_name,
    registration_start_at: raw?.registration_start_at ?? '',
    registration_end_at: raw?.registration_end_at ?? '',
  }
}

function mapLogin(raw: any): StudentLoginResult {
  if (raw?.success) {
    return {
      success: true,
      is_locked: false,
      remaining_attempts: raw.remaining_attempts ?? 5,
      emergency_contacts: raw.emergency_contacts ?? [],
    }
  }
  return {
    success: false,
    remaining_attempts: raw?.remaining_attempts ?? 0,
    is_locked: !!raw?.is_locked,
    message: raw?.message || '登入失敗',
  }
}

const mapReg = (r: any): Registration => ({
  id: r.id,
  student_id: r.student_id,
  camp_id: r.camp_id,
  status: r.status,
  assigned_sub_class: r.assigned_sub_class ?? undefined,
  created_at: r.created_at,
  cancelled_at: r.cancelled_at ?? undefined,
  leave_dates: r.leave_dates ?? [],
  leave_reason: r.leave_reason ?? undefined,
})

function createSupaRepo(sb: SupabaseClient): Repo {
  return {
    async listCamps() {
      const { data, error } = await sb.from('camp_camps').select('data')
      if (error) throw error
      return (data ?? []).map(d => d.data as Camp)
    },
    async listRegs() {
      const { data, error } = await sb.from('camp_registrations').select('*')
      if (error) throw error
      return (data ?? []).map(mapReg)
    },
    async upsertRegs(rs) {
      const rows = rs.map(r => ({
        id: r.id,
        student_id: r.student_id,
        camp_id: r.camp_id,
        status: r.status,
        assigned_sub_class: r.assigned_sub_class ?? null,
        created_at: r.created_at,
        cancelled_at: r.cancelled_at ?? null,
        leave_dates: r.leave_dates ?? [],
        leave_reason: r.leave_reason ?? null,
      }))
      const { error } = await sb.from('camp_registrations').upsert(rows)
      if (error) throw error
    },

    async getPublicSettings() {
      const { data, error } = await sb.rpc('camp_get_public_settings')
      if (error) rpcError(error)
      return mapPublicSettings(data)
    },

    async verifyStudentLogin(studentId, password) {
      const { data, error } = await sb.rpc('camp_verify_student_login', {
        p_student_id: studentId,
        p_password: password,
      })
      if (error) rpcError(error)
      return mapLogin(data)
    },

    async updateStudentProfile(studentId, currentPassword, newPassword, emergencyContacts) {
      const { data, error } = await sb.rpc('camp_update_student_profile', {
        p_student_id: studentId,
        p_current_password: currentPassword,
        p_new_password: newPassword,
        p_emergency_contacts: emergencyContacts,
      })
      if (error) rpcError(error)
      return { ...mapLogin(data), updated: !!data?.updated }
    },

    async verifyAdminAndFetchAll(adminPassword) {
      const { data, error } = await sb.rpc('camp_verify_admin_and_fetch_all', {
        p_admin_password: adminPassword,
      })
      if (error) rpcError(error)
      if (!data?.success) throw new Error('ADMIN_AUTH_FAILED')
      return {
        success: true as const,
        settings: mapPublicSettings(data.settings),
        profiles: (data.profiles ?? []) as StudentProfileView[],
      }
    },

    async adminUnlockStudent(adminPassword, studentId) {
      const { error } = await sb.rpc('camp_admin_unlock_student', {
        p_admin_password: adminPassword,
        p_student_id: studentId,
      })
      if (error) rpcError(error)
    },

    async adminResetStudentPassword(adminPassword, studentId) {
      const { error } = await sb.rpc('camp_admin_reset_student_password', {
        p_admin_password: adminPassword,
        p_student_id: studentId,
      })
      if (error) rpcError(error)
    },

    async adminSetContacts(adminPassword, studentId, contacts) {
      const { error } = await sb.rpc('camp_admin_set_contacts', {
        p_admin_password: adminPassword,
        p_student_id: studentId,
        p_emergency_contacts: contacts,
      })
      if (error) rpcError(error)
    },

    async adminSaveSettings(adminPassword, patch) {
      const { data, error } = await sb.rpc('camp_admin_save_settings', {
        p_admin_password: adminPassword,
        p_term_name: patch.term_name,
        p_registration_start_at: patch.registration_start_at || null,
        p_registration_end_at: patch.registration_end_at || null,
        p_new_admin_password: patch.new_admin_password ?? null,
      })
      if (error) rpcError(error)
      return mapPublicSettings(data)
    },

    async adminSaveCamp(adminPassword, camp) {
      const { error } = await sb.rpc('camp_admin_save_camp', {
        p_admin_password: adminPassword,
        p_camp: camp,
      })
      if (error) rpcError(error)
    },

    async adminDeleteCamp(adminPassword, campId) {
      const { error } = await sb.rpc('camp_admin_delete_camp', {
        p_admin_password: adminPassword,
        p_camp_id: campId,
      })
      if (error) rpcError(error)
    },
  }
}

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const sb = url && key ? createClient(url, key) : null

export const getRepo = (): Repo => (sb ? createSupaRepo(sb) : localRepo)
