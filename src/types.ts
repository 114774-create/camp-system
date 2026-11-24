export interface Student {
  student_id: string
  grade: number
  classCode: string
  no: number
  name: string
  /** 試算表提供的遮罩姓名（未登入時優先使用） */
  maskedName?: string
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
  /** 正規化後的學生姓名（去除所有空白）——密碼與聯絡人的唯一鍵 */
  student_name: string
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
  season: 'winter' | 'summer' | 'holiday'
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
  /** 教師點名簿 PIN（4 碼）。僅後台載入／儲存時存在；公開讀取的營隊資料絕不含此欄位 */
  teacher_pin?: string
}

export type RegStatus = 'enrolled' | 'waitlisted' | 'cancelled'

export interface Registration {
  id: string
  /** 正規化姓名：報名紀錄「跟著學生走」，所有查詢與防呆比對都以此為準 */
  student_name: string
  /** 報名當下的學號快照，僅供行政查閱當時班級，不用於任何比對 */
  snapshot_student_id?: string
  camp_id: string
  /** enrolled=正取；waitlisted=候補（依 created_at 先後遞補）；cancelled=已取消 */
  status: RegStatus
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
  /** 全站緊急公告（颱風停課等） */
  global_alert_message: string
  global_alert_active: boolean
}

/** @deprecated 使用 PublicSettings；保留別名避免舊引用中斷 */
export type SystemSettings = PublicSettings

export type Locale = 'zh-TW' | 'en'
export type Tab = 'front' | 'profile' | 'status' | 'camps' | 'students' | 'settings' | 'r1' | 'r2' | 'r3'

export type StudentLoginResult =
  | { success: true; emergency_contacts: EmergencyContact[]; is_locked: false; remaining_attempts: number }
  | { success: false; remaining_attempts: number; is_locked: boolean; message: string }

// ─── 點名簿／手足／密碼重設 ───
export type AttendStatus = 'present' | 'absent'
export interface AttendanceMark { student_name: string; date: string; status: AttendStatus }
export interface RosterEntry { student_name: string; snapshot_student_id?: string; assigned_sub_class?: string; leave_dates: string[] }
export type TeacherRosterResult =
  | { success: true; camp: Camp; roster: RosterEntry[]; marks: AttendanceMark[] }
  | { success: false; message: string; locked?: boolean }
export type BindSiblingResult =
  | { success: true; copied: boolean; emergency_contacts: EmergencyContact[] }
  | { success: false; message: string; who?: 'A' | 'B'; is_locked?: boolean }
export interface ResetPasswordResult { success: boolean; message: string; locked?: boolean }
export interface RosterSyncResult { count: number; duplicates: string[] }
