import { Camp, Registration, Student } from '../types'
export type VResult = { ok: true } | { ok: false; code: 'GRADE' | 'FULL' | 'CONFLICT' | 'GROUP' | 'DUP'; message: string }
export const md = (d: string) => { const [, m, x] = d.split('-'); return `${+m}/${+x}` }
const overlap = (a: Camp, b: Camp) => a.start_time < b.end_time && b.start_time < a.end_time
/** existingRegistrations = 全校所有報名紀錄（用來算名額與學生既有報名） */
export function validateRegistration(student: Student, target: Camp, targetDate: string, existingRegistrations: Registration[], allCamps: Camp[]): VResult {
  const fail = (code: any, message: string): VResult => ({ ok: false, code, message })
  const camp = (id: string) => allCamps.find(c => c.id === id)!
  const active = existingRegistrations.filter(r => r.status === 'enrolled')
  const mine = active.filter(r => r.student_id === student.student_id)
  if (!target.allowed_grades.includes(student.grade)) return fail('GRADE', '年級不符')
  if (mine.some(r => r.camp_id === target.id)) return fail('DUP', '您已報名此營隊')
  if (target.group_id && target.attendance_mode === 'single_day_choice') {
    const o = mine.map(r => camp(r.camp_id)).find(c => c.group_id === target.group_id)
    if (o) return fail('GROUP', `您已報名本活動的 ${md(o.dates[0])} 場次！若欲改參加 ${md(targetDate)}，請先取消 ${md(o.dates[0])} 的報名後再重新選擇。`)
  }
  if (active.filter(r => r.camp_id === target.id).length >= target.max_capacity) return fail('FULL', '名額已滿')
  for (const r of mine) {
    const c = camp(r.camp_id)
    if (!c.dates.some(d => target.dates.includes(d)) || !overlap(c, target)) continue
    const ok = target.ignore_time_conflict || c.ignore_time_conflict || target.allow_concurrent_with.includes(c.id) || c.allow_concurrent_with.includes(target.id)
    if (!ok) return fail('CONFLICT', `與「${c.name}」時段衝堂（${c.start_time}-${c.end_time}）`)
  }
  return { ok: true }
}
/** 前台按鈕狀態：只有「年級不符/已報名/額滿」會鎖定；衝堂與擇一則點擊後顯示提示 */
export const buttonState = (v: VResult) =>
  v.ok ? { label: '報名', disabled: false }
  : v.code === 'GRADE' ? { label: '年級不符', disabled: true }
  : v.code === 'FULL' ? { label: '已額滿', disabled: true }
  : v.code === 'DUP' ? { label: '已報名', disabled: true }
  : { label: '報名', disabled: false }
