export interface Student { student_id: string; grade: number; classCode: string; no: number; name: string; ename?: string }
export interface CampSubClass { id: string; name: string; grades?: number[] } // grades：依年級自動分班規則
export interface CampSessionDate { camp_id: string; date: string } // YYYY-MM-DD
export interface Camp {
  id: string; term: string; season: 'winter' | 'summer'; name: string
  group_id?: string                       // single_day_choice 共用群組
  attendance_mode: 'full_course' | 'single_day_choice'
  dates: string[]; start_time: string; end_time: string
  allowed_grades: number[]; max_capacity: number
  ignore_time_conflict: boolean; allow_concurrent_with: string[]
  has_sub_classes: boolean; sub_classes: CampSubClass[]
  location: string; teacher: string; notes: string
}
export interface Registration {
  id: string; student_id: string; camp_id: string
  status: 'enrolled' | 'cancelled'
  assigned_sub_class?: string; created_at: string; cancelled_at?: string
}
