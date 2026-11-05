import { createClient } from '@supabase/supabase-js'
import { Camp, Registration, StudentProfile, SystemSettings } from '../types'
import { DEFAULT_SETTINGS, SEED } from './seed'
import { defaultProfile } from '../lib/auth'

export interface Repo {
  listCamps(): Promise<Camp[]>
  saveCamp(c: Camp): Promise<void>
  deleteCamp(id: string): Promise<void>
  listRegs(): Promise<Registration[]>
  upsertRegs(r: Registration[]): Promise<void>
  listProfiles(): Promise<StudentProfile[]>
  saveProfile(p: StudentProfile): Promise<void>
  getSettings(): Promise<SystemSettings>
  saveSettings(s: SystemSettings): Promise<void>
}

const ls = <T,>(k: string, init: T): T => {
  try {
    const x = localStorage.getItem(k)
    return x ? JSON.parse(x) as T : init
  } catch {
    return init
  }
}

const localRepo: Repo = {
  async listCamps() { return ls('camp_camps', SEED) },
  async saveCamp(c) {
    const l = ls<Camp[]>('camp_camps', SEED)
    localStorage.setItem('camp_camps', JSON.stringify(l.some(x => x.id === c.id) ? l.map(x => x.id === c.id ? c : x) : [...l, c]))
  },
  async deleteCamp(id) {
    localStorage.setItem('camp_camps', JSON.stringify(ls<Camp[]>('camp_camps', SEED).filter(x => x.id !== id)))
  },
  async listRegs() {
    return ls<Registration[]>('camp_regs', []).map(r => ({
      ...r,
      leave_dates: r.leave_dates ?? [],
    }))
  },
  async upsertRegs(rs) {
    const l = ls<Registration[]>('camp_regs', [])
    const m = new Map(l.map(x => [x.id, x]))
    rs.forEach(r => m.set(r.id, { ...r, leave_dates: r.leave_dates ?? [] }))
    localStorage.setItem('camp_regs', JSON.stringify([...m.values()]))
  },
  async listProfiles() { return ls<StudentProfile[]>('camp_profiles', []) },
  async saveProfile(p) {
    const l = ls<StudentProfile[]>('camp_profiles', [])
    localStorage.setItem('camp_profiles', JSON.stringify(l.some(x => x.student_id === p.student_id) ? l.map(x => x.student_id === p.student_id ? p : x) : [...l, p]))
  },
  async getSettings() { return ls('camp_settings', DEFAULT_SETTINGS) },
  async saveSettings(s) { localStorage.setItem('camp_settings', JSON.stringify(s)) },
}

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const sb = url && key ? createClient(url, key) : null

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

const mapProfile = (r: any): StudentProfile => ({
  student_id: r.student_id,
  password_hash: r.password_hash,
  failed_attempts: r.failed_attempts ?? 0,
  is_locked: !!r.is_locked,
  emergency_contacts: r.emergency_contacts ?? [],
})

const supaRepo: Repo = {
  async listCamps() {
    const { data, error } = await sb!.from('camp_camps').select('data')
    if (error) throw error
    return (data ?? []).map(d => d.data as Camp)
  },
  async saveCamp(c) {
    const { error } = await sb!.from('camp_camps').upsert({ id: c.id, data: c })
    if (error) throw error
  },
  async deleteCamp(id) {
    const { error } = await sb!.from('camp_camps').delete().eq('id', id)
    if (error) throw error
  },
  async listRegs() {
    const { data, error } = await sb!.from('camp_registrations').select('*')
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
    const { error } = await sb!.from('camp_registrations').upsert(rows)
    if (error) throw error
  },
  async listProfiles() {
    const { data, error } = await sb!.from('camp_student_profiles').select('*')
    if (error) throw error
    return (data ?? []).map(mapProfile)
  },
  async saveProfile(p) {
    const { error } = await sb!.from('camp_student_profiles').upsert({
      student_id: p.student_id,
      password_hash: p.password_hash,
      failed_attempts: p.failed_attempts,
      is_locked: p.is_locked,
      emergency_contacts: p.emergency_contacts,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
  },
  async getSettings() {
    const { data, error } = await sb!.from('camp_system_settings').select('*').eq('id', 'default').maybeSingle()
    if (error) throw error
    if (!data) return DEFAULT_SETTINGS
    return {
      id: data.id,
      admin_password: data.admin_password,
      registration_start_at: data.registration_start_at ?? '',
      registration_end_at: data.registration_end_at ?? '',
      term_name: data.term_name ?? DEFAULT_SETTINGS.term_name,
    }
  },
  async saveSettings(s) {
    const { error } = await sb!.from('camp_system_settings').upsert({
      ...s,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
  },
}

export const getRepo = (): Repo => (sb ? supaRepo : localRepo)

export function ensureProfile(profiles: StudentProfile[], studentId: string): StudentProfile {
  return profiles.find(p => p.student_id === studentId) ?? defaultProfile(studentId)
}
