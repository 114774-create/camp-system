import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  AttendStatus, BindSiblingResult, Camp, EmergencyContact, PublicSettings, Registration, ResetPasswordResult,
  RosterSyncResult, StudentLoginResult, StudentProfileView, TeacherRosterResult,
} from '../types'
import { generatePin, isValidPin } from '../lib/pin'
import { isValidContact } from '../lib/phone'
import { DUPLICATE_NAME_MESSAGE, normName } from '../lib/name'
import { DEFAULT_LOCAL_SETTINGS_STORE, DEFAULT_PUBLIC_SETTINGS, LocalSettingsStore, SEED } from './seed'
import { LOCAL_ADMIN_PASSWORD_SHA256, matchesLocalHash, sha256Hex } from '../lib/localCrypto'

export interface AdminBundle {
  success: true
  settings: PublicSettings
  profiles: StudentProfileView[]
  /** camp_id → 教師點名 PIN（僅後台可得） */
  teacher_pins: Record<string, string>
}

export interface Repo {
  listCamps(): Promise<Camp[]>
  listRegs(): Promise<Registration[]>
  upsertRegs(r: Registration[]): Promise<void>

  getPublicSettings(): Promise<PublicSettings>
  /** 學生以「姓名」為鍵；studentId 僅用於首次登入（預設密碼＝目前學號，並由名單驗證學號↔姓名） */
  verifyStudentLogin(studentName: string, password: string, studentId?: string): Promise<StudentLoginResult>
  updateStudentProfile(
    studentName: string,
    currentPassword: string,
    newPassword: string | null,
    emergencyContacts: EmergencyContact[] | null,
    studentId?: string,
  ): Promise<StudentLoginResult & { updated?: boolean }>

  verifyAdminAndFetchAll(adminPassword: string): Promise<AdminBundle>
  adminUnlockStudent(adminPassword: string, studentName: string, studentId?: string): Promise<void>
  /** 重設為預設密碼＝該生「目前的學號」 */
  adminResetStudentPassword(adminPassword: string, studentName: string, studentId: string): Promise<void>
  adminSetContacts(adminPassword: string, studentName: string, contacts: EmergencyContact[], studentId?: string): Promise<void>
  /** 後台登入時把 Google 試算表名單同步進資料庫（首次登入以此驗證學號↔姓名） */
  adminSyncRoster(adminPassword: string, students: { student_id: string; student_name: string }[]): Promise<RosterSyncResult>
  adminSaveSettings(
    adminPassword: string,
    patch: {
      term_name: string; registration_start_at: string; registration_end_at: string; new_admin_password?: string
      global_alert_message?: string; global_alert_active?: boolean
    },
  ): Promise<PublicSettings>
  /** camp.teacher_pin 不會存進公開的營隊資料；伺服器另存並回傳實際 PIN */
  adminSaveCamp(adminPassword: string, camp: Camp): Promise<{ teacher_pin?: string }>
  adminDeleteCamp(adminPassword: string, campId: string): Promise<void>
  /** 候補遞補轉正：伺服器端檢查名額，已滿拋出 CAMP_FULL */
  adminPromoteWaitlist(adminPassword: string, regId: string): Promise<void>

  /** 忘記密碼：學號 + 主要緊急聯絡人電話 */
  /** newPassword 為 null＝重設回預設密碼（目前學號，has_custom_password=false）；有值＝家長自訂新密碼（true） */
  resetPasswordByPhone(studentName: string, phone: string, newPassword: string | null, studentId?: string): Promise<ResetPasswordResult>
  /** 手足綁定：以姓名驗證兩個帳號；B 沒有聯絡人時自動複製 A 的 */
  bindSibling(a: { name: string; id: string; password: string }, b: { name: string; id: string; password: string }): Promise<BindSiblingResult>
  /** 教師點名簿（以營隊 PIN 驗證） */
  teacherRoster(campId: string, pin: string): Promise<TeacherRosterResult>
  teacherMark(campId: string, pin: string, studentName: string, date: string, status: AttendStatus | null): Promise<{ success: boolean; message?: string }>
}

// ─── localStorage 內部結構（含 hash，永不當作公開 API 回傳）───

interface LocalProfileRow {
  student_name: string
  password_hash: string
  failed_attempts: number
  is_locked: boolean
  emergency_contacts: EmergencyContact[]  /** false＝沒改過密碼，預設密碼＝目前學號；舊資料（無此欄位）保守視為 true */
  has_custom_password?: boolean
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
    student_name: r.student_name,
    failed_attempts: r.failed_attempts,
    is_locked: r.is_locked,
    emergency_contacts: r.emergency_contacts ?? [],
  }
}

function getLocalSettings(): LocalSettingsStore {
  const raw = ls<LocalSettingsStore | null>('camp_settings_secure', null)
  if (!raw?.admin_password_hash) return { ...DEFAULT_LOCAL_SETTINGS_STORE }
  return { ...DEFAULT_LOCAL_SETTINGS_STORE, ...raw }
}

function getLocalProfiles(): LocalProfileRow[] {
  return ls<LocalProfileRow[]>('camp_profiles_by_name', [])
}

function saveLocalProfile(p: LocalProfileRow) {
  const list = getLocalProfiles()
  const next = list.some(x => x.student_name === p.student_name)
    ? list.map(x => x.student_name === p.student_name ? p : x)
    : [...list, p]
  saveLs('camp_profiles_by_name', next)
}

async function localAssertAdmin(adminPassword: string) {
  const s = getLocalSettings()
  if (!(await matchesLocalHash(adminPassword, s.admin_password_hash || LOCAL_ADMIN_PASSWORD_SHA256))) {
    throw new Error('ADMIN_AUTH_FAILED')
  }
}

// ─── 本機示範：教師 PIN／點名／忘記密碼計次（邏輯與 schema.sql 對應）───
interface LocalPinRow { pin: string; failed: number; lockedUntil: number }
interface LocalMark { camp_id: string; student_name: string; date: string; status: AttendStatus }
const PIN_MAX_FAILS = 8, PIN_LOCK_MS = 15 * 60_000, RESET_MAX_FAILS = 5, RESET_LOCK_MS = 30 * 60_000
const RESET_GENERIC = '驗證失敗：學號或主要聯絡人電話不符。連續錯誤多次將暫停此功能 30 分鐘。'
const getPins = () => ls<Record<string, LocalPinRow>>('camp_teacher_pins', {})
function ensurePins(camps: Camp[]) {
  const m = getPins(); let changed = false
  for (const c of camps) if (!m[c.id]) { m[c.id] = { pin: generatePin(), failed: 0, lockedUntil: 0 }; changed = true }
  if (changed) saveLs('camp_teacher_pins', m)
  return m
}
function localTeacherCheck(campId: string, pin: string): { ok: true } | { ok: false; message: string; locked?: boolean } {
  const m = ensurePins(ls<Camp[]>('camp_camps', SEED)); const r = m[campId]
  if (!r) return { ok: false, message: '查無此營隊，或尚未設定教師 PIN' }
  if (r.lockedUntil > Date.now()) return { ok: false, locked: true, message: 'PIN 錯誤次數過多，請 15 分鐘後再試' }
  if (pin && pin === r.pin) { if (r.failed || r.lockedUntil) { m[campId] = { ...r, failed: 0, lockedUntil: 0 }; saveLs('camp_teacher_pins', m) } return { ok: true } }
  if (r.failed + 1 >= PIN_MAX_FAILS) {
    m[campId] = { ...r, failed: 0, lockedUntil: Date.now() + PIN_LOCK_MS }; saveLs('camp_teacher_pins', m)
    return { ok: false, locked: true, message: 'PIN 錯誤次數過多，已暫停 15 分鐘' }
  }
  m[campId] = { ...r, failed: r.failed + 1 }; saveLs('camp_teacher_pins', m)
  return { ok: false, message: `PIN 錯誤（尚可嘗試 ${PIN_MAX_FAILS - (r.failed + 1)} 次）` }
}

interface LocalRosterRow { student_id: string; student_name: string }
const getRoster = () => ls<LocalRosterRow[]>('camp_roster', [])
const NO_RECORD_MSG = '查無此學生資料，請洽學校行政人員（學生名單可能尚未同步）'
const dupCount = (roster: LocalRosterRow[], key: string) => roster.filter(r => r.student_name === key).length

const localRepo: Repo = {
  async listCamps() { return ls('camp_camps', SEED) },
  async listRegs() {
    return ls<Registration[]>('camp_regs_by_name', []).map(r => ({ ...r, leave_dates: r.leave_dates ?? [] }))
  },
  async upsertRegs(rs) {
    const l = ls<Registration[]>('camp_regs_by_name', [])
    const m = new Map(l.map(x => [x.id, x]))
    rs.forEach(r => m.set(r.id, { ...r, leave_dates: r.leave_dates ?? [] }))
    saveLs('camp_regs_by_name', [...m.values()])
  },

  async getPublicSettings() {
    const s = getLocalSettings()
    return {
      id: s.id,
      term_name: s.term_name,
      registration_start_at: s.registration_start_at,
      registration_end_at: s.registration_end_at,
      global_alert_message: s.global_alert_message,
      global_alert_active: s.global_alert_active,
    }
  },

  async verifyStudentLogin(studentName, password, studentId) {
    const key = normName(studentName)
    const id = (studentId ?? '').trim()
    if (!key) return { success: false, remaining_attempts: 0, is_locked: true, message: '無效的學生資料' }
    const roster = getRoster()
    if (dupCount(roster, key) > 1) return { success: false, remaining_attempts: 0, is_locked: false, message: DUPLICATE_NAME_MESSAGE }
    let row = getLocalProfiles().find(p => p.student_name === key)

    if (!row) {
      // 首次登入：名單非空時必須「學號↔姓名」相符（對應 schema.sql）；名單為空僅限本機示範
      if (!id || (roster.length && !roster.some(r => r.student_id === id && r.student_name === key))) {
        return { success: false, remaining_attempts: 0, is_locked: false, message: NO_RECORD_MSG }
      }
      if (password === id) {
        row = { student_name: key, password_hash: await sha256Hex(password), failed_attempts: 0, is_locked: false, emergency_contacts: [], has_custom_password: false }
        saveLocalProfile(row)
        return { success: true, is_locked: false, remaining_attempts: 5, emergency_contacts: [] }
      }
      saveLocalProfile({ student_name: key, password_hash: await sha256Hex(id), failed_attempts: 1, is_locked: false, emergency_contacts: [], has_custom_password: false })
      return { success: false, remaining_attempts: 4, is_locked: false, message: '密碼錯誤（尚可嘗試 4 次）' }
    }

    if (row.is_locked) {
      return {
        success: false, remaining_attempts: 0, is_locked: true,
        message: '密碼錯誤已達 5 次，帳號已鎖定，請使用「忘記密碼／帳號解鎖」或聯繫學校行政人員',
      }
    }

    let ok: boolean
    if (row.has_custom_password ?? true) {
      ok = await matchesLocalHash(password, row.password_hash)
    } else {
      // 沒改過密碼：預設密碼＝目前學號，且名單非空時必須確認「學號↔姓名」相符（對應 schema.sql；否則任何人都能傳 id=password）
      if (!id || (roster.length && !roster.some(r => r.student_id === id && r.student_name === key))) {
        return { success: false, remaining_attempts: 5 - row.failed_attempts, is_locked: false, message: NO_RECORD_MSG }
      }
      ok = password === id
    }

    if (ok) {
      row = { ...row, failed_attempts: 0 }
      saveLocalProfile(row)
      return { success: true, is_locked: false, remaining_attempts: 5, emergency_contacts: row.emergency_contacts ?? [] }
    }

    const attempts = row.failed_attempts + 1
    const locked = attempts >= 5
    saveLocalProfile({ ...row, failed_attempts: attempts, is_locked: locked })
    return {
      success: false,
      remaining_attempts: Math.max(0, 5 - attempts),
      is_locked: locked,
      message: locked
        ? '密碼錯誤已達 5 次，帳號已鎖定，請使用「忘記密碼／帳號解鎖」或聯繫學校行政人員'
        : `密碼錯誤（尚可嘗試 ${5 - attempts} 次）`,
    }
  },

  async updateStudentProfile(studentName, currentPassword, newPassword, emergencyContacts, studentId) {
    const key = normName(studentName)
    const login = await this.verifyStudentLogin(key, currentPassword, studentId)
    if (!login.success) return { ...login, updated: false }
    let row = getLocalProfiles().find(p => p.student_name === key)!
    if (newPassword && newPassword.trim().length >= 4) {
      row = { ...row, password_hash: await sha256Hex(newPassword), has_custom_password: true, failed_attempts: 0 }
    }
    if (emergencyContacts) {
      row = { ...row, emergency_contacts: emergencyContacts }
    }
    saveLocalProfile(row)
    return { success: true, is_locked: false, remaining_attempts: 5, emergency_contacts: row.emergency_contacts, updated: true }
  },

  async verifyAdminAndFetchAll(adminPassword) {
    await localAssertAdmin(adminPassword)
    const s = await this.getPublicSettings()
    const pins = ensurePins(ls<Camp[]>('camp_camps', SEED))
    return {
      success: true as const,
      settings: s,
      profiles: getLocalProfiles().map(toView),
      teacher_pins: Object.fromEntries(Object.entries(pins).map(([k, v]) => [k, v.pin])),
    }
  },

  async adminUnlockStudent(adminPassword, studentName, studentId) {
    await localAssertAdmin(adminPassword)
    const key = normName(studentName)
    const existing = getLocalProfiles().find(p => p.student_name === key)
    saveLocalProfile({
      student_name: key,
      password_hash: existing?.password_hash ?? await sha256Hex(studentId ?? key),
      has_custom_password: existing?.has_custom_password ?? false,
      failed_attempts: 0,
      is_locked: false,
      emergency_contacts: existing?.emergency_contacts ?? [],
    })
    const att = ls<Record<string, unknown>>('camp_reset_attempts', {}); delete att[key]; saveLs('camp_reset_attempts', att)
  },

  async adminResetStudentPassword(adminPassword, studentName, studentId) {
    await localAssertAdmin(adminPassword)
    const key = normName(studentName)
    if (!key || !studentId.trim()) throw new Error('INVALID_STUDENT')
    const existing = getLocalProfiles().find(p => p.student_name === key)
    saveLocalProfile({
      student_name: key,
      password_hash: await sha256Hex(studentId),
      has_custom_password: false,
      failed_attempts: 0,
      is_locked: false,
      emergency_contacts: existing?.emergency_contacts ?? [],
    })
    const att = ls<Record<string, unknown>>('camp_reset_attempts', {}); delete att[key]; saveLs('camp_reset_attempts', att)
  },

  async adminSetContacts(adminPassword, studentName, contacts, studentId) {
    await localAssertAdmin(adminPassword)
    const key = normName(studentName)
    const existing = getLocalProfiles().find(p => p.student_name === key)
    saveLocalProfile({
      student_name: key,
      password_hash: existing?.password_hash ?? await sha256Hex(studentId ?? key),
      has_custom_password: existing?.has_custom_password ?? false,
      failed_attempts: existing?.failed_attempts ?? 0,
      is_locked: existing?.is_locked ?? false,
      emergency_contacts: contacts,
    })
  },

  async adminSyncRoster(adminPassword, students) {
    await localAssertAdmin(adminPassword)
    const byId = new Map<string, LocalRosterRow>()
    for (const s of students) {
      const id = s.student_id.trim(), name = normName(s.student_name)
      if (id && name && !byId.has(id)) byId.set(id, { student_id: id, student_name: name })
    }
    const roster = [...byId.values()]
    saveLs('camp_roster', roster)
    const counts = new Map<string, number>()
    roster.forEach(r => counts.set(r.student_name, (counts.get(r.student_name) ?? 0) + 1))
    return { count: roster.length, duplicates: [...counts].filter(([, n]) => n > 1).map(([k]) => k) }
  },

  async adminSaveSettings(adminPassword, patch) {
    await localAssertAdmin(adminPassword)
    const cur = getLocalSettings()
    const next: LocalSettingsStore = {
      ...cur,
      term_name: patch.term_name,
      registration_start_at: patch.registration_start_at,
      registration_end_at: patch.registration_end_at,
      global_alert_message: (patch.global_alert_message ?? cur.global_alert_message).slice(0, 300),
      global_alert_active: patch.global_alert_active ?? cur.global_alert_active,
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
      global_alert_message: next.global_alert_message,
      global_alert_active: next.global_alert_active,
    }
  },

  async adminSaveCamp(adminPassword, camp) {
    await localAssertAdmin(adminPassword)
    const { teacher_pin, ...pub } = camp   // PIN 不進公開資料
    if (teacher_pin && !isValidPin(teacher_pin)) throw new Error('INVALID_PIN')
    const l = ls<Camp[]>('camp_camps', SEED)
    saveLs('camp_camps', l.some(x => x.id === pub.id) ? l.map(x => x.id === pub.id ? pub : x) : [...l, pub])
    const pins = getPins()
    pins[pub.id] = { pin: teacher_pin ?? pins[pub.id]?.pin ?? generatePin(), failed: 0, lockedUntil: 0 }
    saveLs('camp_teacher_pins', pins)
    return { teacher_pin: pins[pub.id].pin }
  },

  async adminDeleteCamp(adminPassword, campId) {
    await localAssertAdmin(adminPassword)
    saveLs('camp_camps', ls<Camp[]>('camp_camps', SEED).filter(x => x.id !== campId))
    const pins = getPins(); delete pins[campId]; saveLs('camp_teacher_pins', pins)
    saveLs('camp_attendance_by_name', ls<LocalMark[]>('camp_attendance_by_name', []).filter(m => m.camp_id !== campId))
  },

  async adminPromoteWaitlist(adminPassword, regId) {
    await localAssertAdmin(adminPassword)
    const regs = ls<Registration[]>('camp_regs_by_name', [])
    const r = regs.find(x => x.id === regId)
    if (!r || r.status !== 'waitlisted') throw new Error('NOT_WAITLISTED')
    const camp = ls<Camp[]>('camp_camps', SEED).find(c => c.id === r.camp_id)
    const n = regs.filter(x => x.camp_id === r.camp_id && x.status === 'enrolled').length
    if (camp && n >= camp.max_capacity) throw new Error('CAMP_FULL')
    saveLs('camp_regs_by_name', regs.map(x => x.id === regId ? { ...x, status: 'enrolled' as const } : x))
  },

  async resetPasswordByPhone(studentName, phone, newPassword, studentId) {
    const key = normName(studentName)
    if (!key || (newPassword !== null && newPassword.trim().length < 4)) return { success: false, message: '請輸入學號與電話，且新密碼至少 4 碼' }
    if (dupCount(getRoster(), key) > 1) return { success: false, message: RESET_GENERIC }
    const row = getLocalProfiles().find(p => p.student_name === key)
    if (!row) return { success: false, message: RESET_GENERIC }
    const att = ls<Record<string, { n: number; lockedUntil: number }>>('camp_reset_attempts', {})
    const cur = att[key] ?? { n: 0, lockedUntil: 0 }
    if (cur.lockedUntil > Date.now()) return { success: false, locked: true, message: '嘗試次數過多，此功能暫停 30 分鐘，請稍後再試或洽學校行政人員' }
    const list = row.emergency_contacts ?? []
    const primary = list.find(c => c.is_primary) ?? list[0]
    const digits = (x: string) => x.replace(/[^0-9]/g, '')
    if (primary && digits(primary.phone) !== '' && digits(primary.phone) === digits(phone)) {
      delete att[key]; saveLs('camp_reset_attempts', att)
      if (newPassword !== null) {
        saveLocalProfile({ ...row, password_hash: await sha256Hex(newPassword), has_custom_password: true, is_locked: false, failed_attempts: 0 })
        return { success: true, message: '密碼已重設，帳號已解鎖，請用新密碼登入' }
      }
      const roster = getRoster()
      const idOk = !!studentId && (!roster.length || roster.some(r => r.student_id === studentId && r.student_name === key))
      saveLocalProfile({ ...row, password_hash: idOk ? await sha256Hex(studentId!) : row.password_hash, has_custom_password: false, is_locked: false, failed_attempts: 0 })
      return { success: true, message: '已重設為預設密碼（目前的學號），帳號已解鎖。登入後請記得修改密碼' }
    }
    att[key] = cur.n + 1 >= RESET_MAX_FAILS ? { n: 0, lockedUntil: Date.now() + RESET_LOCK_MS } : { n: cur.n + 1, lockedUntil: 0 }
    saveLs('camp_reset_attempts', att)
    return { success: false, message: RESET_GENERIC }
  },

  async bindSibling(a, b) {
    const na = normName(a.name), nb = normName(b.name)
    if (!na || !nb || na === nb) return { success: false, message: '請輸入另一位學生的學號' }
    const la = await this.verifyStudentLogin(na, a.password, a.id)
    if (!la.success) return { success: false, message: la.message, who: 'A', is_locked: la.is_locked }
    const lb = await this.verifyStudentLogin(nb, b.password, b.id)
    if (!lb.success) return { success: false, message: lb.message, who: 'B', is_locked: lb.is_locked }
    const ca = la.emergency_contacts ?? []
    let cb = lb.emergency_contacts ?? []
    let copied = false
    if (cb.length === 0 && ca.length > 0 && ca.every(isValidContact)) {
      const row = getLocalProfiles().find(p => p.student_name === nb)!
      saveLocalProfile({ ...row, emergency_contacts: ca })
      cb = ca; copied = true
    }
    return { success: true, copied, emergency_contacts: cb }
  },

  async teacherRoster(campId, pin) {
    const chk = localTeacherCheck(campId, pin)
    if (!chk.ok) return { success: false, message: chk.message, locked: chk.locked }
    const camp = ls<Camp[]>('camp_camps', SEED).find(c => c.id === campId)
    if (!camp) return { success: false, message: '查無此營隊，或尚未設定教師 PIN' }
    const roster = ls<Registration[]>('camp_regs_by_name', [])
      .filter(r => r.camp_id === campId && r.status === 'enrolled')
      .map(r => ({ student_name: r.student_name, snapshot_student_id: r.snapshot_student_id, assigned_sub_class: r.assigned_sub_class, leave_dates: r.leave_dates ?? [] }))
    const marks = ls<LocalMark[]>('camp_attendance_by_name', []).filter(m => m.camp_id === campId)
      .map(m => ({ student_name: m.student_name, date: m.date, status: m.status }))
    return { success: true, camp, roster, marks }
  },

  async teacherMark(campId, pin, studentName, date, status) {
    const name = normName(studentName)
    const chk = localTeacherCheck(campId, pin)
    if (!chk.ok) return { success: false, message: chk.message }
    const camp = ls<Camp[]>('camp_camps', SEED).find(c => c.id === campId)
    if (!camp?.dates.includes(date)) return { success: false, message: '此日期不在營隊上課日期內' }
    const enrolled = ls<Registration[]>('camp_regs_by_name', []).some(r => r.camp_id === campId && r.student_name === name && r.status === 'enrolled')
    if (!enrolled) return { success: false, message: '此學生不在報名名單中' }
    const rest = ls<LocalMark[]>('camp_attendance_by_name', []).filter(m => !(m.camp_id === campId && m.student_name === name && m.date === date))
    saveLs('camp_attendance_by_name', status ? [...rest, { camp_id: campId, student_name: name, date, status }] : rest)
    return { success: true }
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
    global_alert_message: raw?.global_alert_message ?? '',
    global_alert_active: !!raw?.global_alert_active,
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
  student_name: r.student_name,
  snapshot_student_id: r.snapshot_student_id ?? undefined,
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
        student_name: normName(r.student_name),
        snapshot_student_id: r.snapshot_student_id ?? null,
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

    async verifyStudentLogin(studentName, password, studentId) {
      const { data, error } = await sb.rpc('camp_verify_student_login', {
        p_student_name: normName(studentName),
        p_password: password,
        p_student_id: studentId?.trim() || null,
      })
      if (error) rpcError(error)
      return mapLogin(data)
    },

    async updateStudentProfile(studentName, currentPassword, newPassword, emergencyContacts, studentId) {
      const { data, error } = await sb.rpc('camp_update_student_profile', {
        p_student_name: normName(studentName),
        p_current_password: currentPassword,
        p_new_password: newPassword,
        p_emergency_contacts: emergencyContacts,
        p_student_id: studentId?.trim() || null,
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
        teacher_pins: (data.teacher_pins ?? {}) as Record<string, string>,
      }
    },

    async adminUnlockStudent(adminPassword, studentName, studentId) {
      const { error } = await sb.rpc('camp_admin_unlock_student', {
        p_admin_password: adminPassword, p_student_name: normName(studentName), p_student_id: studentId ?? null,
      })
      if (error) rpcError(error)
    },

    async adminResetStudentPassword(adminPassword, studentName, studentId) {
      const { error } = await sb.rpc('camp_admin_reset_student_password', {
        p_admin_password: adminPassword, p_student_name: normName(studentName), p_student_id: studentId,
      })
      if (error) rpcError(error)
    },

    async adminSetContacts(adminPassword, studentName, contacts, studentId) {
      const { error } = await sb.rpc('camp_admin_set_contacts', {
        p_admin_password: adminPassword, p_student_name: normName(studentName),
        p_emergency_contacts: contacts, p_student_id: studentId ?? null,
      })
      if (error) rpcError(error)
    },

    async adminSyncRoster(adminPassword, students) {
      const { data, error } = await sb.rpc('camp_admin_sync_roster', {
        p_admin_password: adminPassword,
        p_students: students.map(s => ({ student_id: s.student_id, student_name: normName(s.student_name) })),
      })
      if (error) rpcError(error)
      return { count: Number(data?.count ?? 0), duplicates: (data?.duplicates ?? []) as string[] }
    },

    async adminSaveSettings(adminPassword, patch) {
      const { data, error } = await sb.rpc('camp_admin_save_settings', {
        p_admin_password: adminPassword,
        p_term_name: patch.term_name,
        p_registration_start_at: patch.registration_start_at || null,
        p_registration_end_at: patch.registration_end_at || null,
        p_new_admin_password: patch.new_admin_password ?? null,
        p_global_alert_message: patch.global_alert_message ?? null,
        p_global_alert_active: patch.global_alert_active ?? null,
      })
      if (error) rpcError(error)
      return mapPublicSettings(data)
    },

    async adminSaveCamp(adminPassword, camp) {
      const { teacher_pin, ...pub } = camp   // PIN 另存，不放進公開的營隊 data
      const { data, error } = await sb.rpc('camp_admin_save_camp', {
        p_admin_password: adminPassword,
        p_camp: pub,
        p_teacher_pin: teacher_pin ?? null,
      })
      if (error) rpcError(error)
      return { teacher_pin: data?.teacher_pin as string | undefined }
    },

    async adminDeleteCamp(adminPassword, campId) {
      const { error } = await sb.rpc('camp_admin_delete_camp', {
        p_admin_password: adminPassword,
        p_camp_id: campId,
      })
      if (error) rpcError(error)
    },

    async adminPromoteWaitlist(adminPassword, regId) {
      const { error } = await sb.rpc('camp_admin_promote_waitlist', {
        p_admin_password: adminPassword,
        p_reg_id: regId,
      })
      if (error) rpcError(error)
    },

    async resetPasswordByPhone(studentName, phone, newPassword, studentId) {
      const { data, error } = await sb.rpc('camp_reset_student_password', {
        p_student_name: normName(studentName), p_phone: phone, p_new_password: newPassword, p_student_id: studentId?.trim() || null,
      })
      if (error) rpcError(error)
      return { success: !!data?.success, message: data?.message ?? '重設失敗', locked: !!data?.locked }
    },

    async bindSibling(a, b) {
      const { data, error } = await sb.rpc('camp_bind_sibling', {
        p_a_name: normName(a.name), p_a_password: a.password, p_b_name: normName(b.name), p_b_password: b.password,
        p_a_id: a.id, p_b_id: b.id,
      })
      if (error) rpcError(error)
      if (!data?.success) return { success: false, message: data?.message ?? '綁定失敗', who: data?.who, is_locked: !!data?.is_locked }
      return { success: true, copied: !!data.copied, emergency_contacts: (data.emergency_contacts ?? []) as EmergencyContact[] }
    },

    async teacherRoster(campId, pin) {
      const { data, error } = await sb.rpc('camp_teacher_get_roster', { p_camp_id: campId, p_pin: pin })
      if (error) rpcError(error)
      if (!data?.success) return { success: false, message: data?.message ?? '驗證失敗', locked: !!data?.locked }
      return {
        success: true,
        camp: data.camp as Camp,
        roster: (data.roster ?? []).map((r: any) => ({ student_name: r.student_name, snapshot_student_id: r.snapshot_student_id ?? undefined, assigned_sub_class: r.assigned_sub_class ?? undefined, leave_dates: r.leave_dates ?? [] })),
        marks: data.marks ?? [],
      }
    },

    async teacherMark(campId, pin, studentName, date, status) {
      const { data, error } = await sb.rpc('camp_teacher_mark', {
        p_camp_id: campId, p_pin: pin, p_student_name: normName(studentName), p_date: date, p_status: status,
      })
      if (error) rpcError(error)
      return { success: !!data?.success, message: data?.message }
    },
  }
}

/** 單元測試強制本機 RPC 模擬，避免誤打正式 Supabase */
export function getRepo(): Repo {
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) return localRepo
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
  if (url && key) return createSupaRepo(createClient(url, key))
  return localRepo
}

/** @internal 測試用 */
export const __localRepo = localRepo
