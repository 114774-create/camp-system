import { AttendanceMark, AttendStatus, RosterEntry, Student } from '../types'

/** 台灣時區的今天（YYYY-MM-DD） */
export const todayTaipei = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

/** 預設點名日期：今天在上課日內就選今天；否則選之後最近的一天；都過了就選最後一天 */
export function pickDefaultDate(dates: string[], today: string): string {
  const ds = [...dates].sort()
  if (!ds.length) return today
  if (ds.includes(today)) return today
  return ds.find(d => d >= today) ?? ds[ds.length - 1]
}

export interface RollRow { student: Student; entry: RosterEntry; status?: AttendStatus; onLeave: boolean }

export function buildRows(roster: RosterEntry[], students: Student[], marks: AttendanceMark[], date: string, subClass = ''): RollRow[] {
  const byId = new Map(students.map(s => [s.student_id, s]))
  return roster
    .filter(e => !subClass || e.assigned_sub_class === subClass)
    .map(entry => ({
      entry,
      student: byId.get(entry.student_id) ?? { student_id: entry.student_id, grade: 0, classCode: '000', no: 0, name: entry.student_id },
      status: marks.find(m => m.student_id === entry.student_id && m.date === date)?.status,
      onLeave: (entry.leave_dates ?? []).includes(date),
    }))
    .sort((a, b) => +a.student.classCode - +b.student.classCode || a.student.no - b.student.no)
}

export function summarize(rows: RollRow[]) {
  const present = rows.filter(r => r.status === 'present').length
  const absent = rows.filter(r => r.status === 'absent').length
  return { total: rows.length, present, absent, pending: rows.length - present - absent }
}
/** 套用一筆點名（status=null 代表清除） */
export function applyMark(marks: AttendanceMark[], studentId: string, date: string, status: AttendStatus | null): AttendanceMark[] {
  const rest = marks.filter(m => !(m.student_id === studentId && m.date === date))
  return status ? [...rest, { student_id: studentId, date, status }] : rest
}
