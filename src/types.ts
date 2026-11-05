export interface Student {
  student_id: string
  grade: number
  classCode: string
  no: number
  name: string
  ename?: string
}

export interface EmergencyContact {
  name: string
  relation: string
  phone: string
  is_primary: boolean
}

/** 前端可持有的學生個資視圖（不含 password_hash） */
export interface StudentProfileView {
  student_id: string
  failed_attempts: number
  is_locked: boolean
  emergency_contacts: EmergencyContact[]
}

export interface CampSubClass {
  id: string
  name: string
  grades?: number[]
}

export interface CampSessionDate {
  camp_id: string
  date: string
}

export interface Camp {
  id: string
  term: string
  season: 'winter' | 'summer'
  name: string
  name_en?: string
  group_id?: string
  attendance_mode: 'full_course' | 'single_day_choice'
  dates: string[]
  start_time: string
  end_time: string
  allowed_grades: number[]
  max_capacity: number
  ignore_time_conflict: boolean
  allow_concurrent_with: string[]
  has_sub_classes: boolean
  sub_classes: CampSubClass[]
  location: string
  teacher: string
  notes: string
}

export interface Registration {
  id: string
  student_id: string
  camp_id: string
  status: 'enrolled' | 'cancelled'
  assigned_sub_class?: string
  created_at: string
  cancelled_at?: string
  leave_dates?: string[]
  leave_reason?: string
}

/** 公開設定（絕不包含後台密碼） */
export interface PublicSettings {
  id: string
  registration_start_at: string
  registration_end_at: string
  term_name: string
}

/** @deprecated 使用 PublicSettings；保留別名避免舊引用中斷 */
export type SystemSettings = PublicSettings

export type Locale = 'zh-TW' | 'en'
export type Tab = 'front' | 'contacts' | 'camps' | 'students' | 'settings' | 'r1' | 'r2' | 'r3'

export type StudentLoginResult =
  | { success: true; emergency_contacts: EmergencyContact[]; is_locked: false; remaining_attempts: number }
  | { success: false; remaining_attempts: number; is_locked: boolean; message: string }
