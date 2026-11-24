import { Camp, Registration, Student, StudentProfileView, Locale } from '../types'
import { normName, studentIndex } from './name'
import { campDisplayName } from './i18n'
import { formatContactLine } from './auth'

export interface ReportProps {
  students: Student[]
  camps: Camp[]
  regs: Registration[]
  profiles?: StudentProfileView[]
  locale?: Locale
}

export const byClassNo = (a: Student, b: Student) => +a.classCode - +b.classCode || a.no - b.no
export const clsName = (c: string) => `${['', '一', '二', '三', '四', '五', '六'][Math.floor(+c / 100)]}年甲班`

export const campLabel = (c: Camp, locale: Locale = 'zh-TW') => {
  const name = campDisplayName(c, locale)
  return c.attendance_mode === 'single_day_choice'
    ? `${name}（${c.dates[0].slice(5).replace('-', '/')}）`
    : name
}

/**
 * 報名紀錄以「姓名」對應到 Google 試算表回傳的「最新」學號與班級座號：
 * 學生升年級後，連去年的營隊印出來的簽到表／通知單，也會自動帶入現在的班級座號。
 * 名單裡已找不到這個姓名（轉出、改名）時，退回用報名當下的學號快照，避免人員在名單中悄悄消失。
 */
export function snapshotStudent(r: Pick<Registration, 'student_name' | 'snapshot_student_id'>): Student {
  const id = r.snapshot_student_id ?? ''
  const ok = /^\d{5}$/.test(id)
  const classCode = ok ? id.slice(0, 3) : '000'
  return { student_id: id, grade: Math.floor(+classCode / 100), classCode, no: ok ? +id.slice(3) : 0, name: r.student_name }
}
export const enrolledJoin = (campId: string, { students, regs }: Pick<ReportProps, 'students' | 'regs'>) => {
  const idx = studentIndex(students)
  return regs.filter(r => r.camp_id === campId && r.status === 'enrolled')
    .map(r => ({ r, s: idx.get(r.student_name) ?? snapshotStudent(r) }))
    .sort((a, b) => byClassNo(a.s, b.s))
}

export const csv = (name: string, rows: (string | number)[][]) => {
  const b = new Blob(['\ufeff' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(b)
  a.download = name + '.csv'
  a.click()
}

export function contactOf(student: Pick<Student, 'name'>, profiles?: StudentProfileView[]) {
  const key = normName(student.name)
  return formatContactLine(profiles?.find(p => p.student_name === key))
}

export function isLeaveDay(r: Registration, date: string) {
  return (r.leave_dates ?? []).includes(date)
}
