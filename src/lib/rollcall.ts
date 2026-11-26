import { AttendanceMark, AttendStatus, Registration, RosterEntry, Student } from '../types'
import { studentIndex } from './name'
import { snapshotStudent } from './report'

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
  const idx = studentIndex(students)
  return roster
    .filter(e => !subClass || e.assigned_sub_class === subClass)
    .map(entry => ({
      entry,
      // 以姓名對應到「最新」學號與班級座號；名單找不到時用報名當下的學號快照
      student: idx.get(entry.student_name) ?? snapshotStudent(entry),
      status: marks.find(m => m.student_name === entry.student_name && m.date === date)?.status,
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
export function applyMark(marks: AttendanceMark[], studentName: string, date: string, status: AttendStatus | null): AttendanceMark[] {
  const rest = marks.filter(m => !(m.student_name === studentName && m.date === date))
  return status ? [...rest, { student_name: studentName, date, status }] : rest
}

/** 後台用：把某營隊的正取報名轉成點名名單（與老師點名頁看到的名單一致） */
export const rosterFromRegs = (regs: Registration[], campId: string): RosterEntry[] =>
  regs.filter(r => r.camp_id === campId && r.status === 'enrolled').map(r => ({
    student_name: r.student_name, snapshot_student_id: r.snapshot_student_id,
    assigned_sub_class: r.assigned_sub_class, leave_dates: r.leave_dates ?? [],
  }))
