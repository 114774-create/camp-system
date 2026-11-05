import { Camp, Registration, Student } from '../types'
export interface ReportProps { students: Student[]; camps: Camp[]; regs: Registration[] }
export const byClassNo = (a: Student, b: Student) => +a.classCode - +b.classCode || a.no - b.no
export const clsName = (c: string) => `${['', '一', '二', '三', '四', '五', '六'][Math.floor(+c / 100)]}年甲班`
export const campLabel = (c: Camp) => c.attendance_mode === 'single_day_choice' ? `${c.name}（${c.dates[0].slice(5).replace('-', '/')}）` : c.name
export const enrolledJoin = (campId: string, { students, regs }: Pick<ReportProps, 'students' | 'regs'>) =>
  regs.filter(r => r.camp_id === campId && r.status === 'enrolled')
    .map(r => ({ r, s: students.find(s => s.student_id === r.student_id)! })).filter(x => x.s)
    .sort((a, b) => byClassNo(a.s, b.s))
export const csv = (name: string, rows: (string | number)[][]) => {
  const b = new Blob(['\ufeff' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name + '.csv'; a.click()
}
