import { Camp, Registration, Student, StudentProfile } from '../types'
import { campDisplayName } from './i18n'
import { Locale } from '../types'
import { formatContactLine } from './auth'

export interface ReportProps {
  students: Student[]
  camps: Camp[]
  regs: Registration[]
  profiles?: StudentProfile[]
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

export const enrolledJoin = (campId: string, { students, regs }: Pick<ReportProps, 'students' | 'regs'>) =>
  regs.filter(r => r.camp_id === campId && r.status === 'enrolled')
    .map(r => ({ r, s: students.find(s => s.student_id === r.student_id)! }))
    .filter(x => x.s)
    .sort((a, b) => byClassNo(a.s, b.s))

export const csv = (name: string, rows: (string | number)[][]) => {
  const b = new Blob(['\ufeff' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(b)
  a.download = name + '.csv'
  a.click()
}

export function contactOf(studentId: string, profiles?: StudentProfile[]) {
  return formatContactLine(profiles?.find(p => p.student_id === studentId))
}

export function isLeaveDay(r: Registration, date: string) {
  return (r.leave_dates ?? []).includes(date)
}
