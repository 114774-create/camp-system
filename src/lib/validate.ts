import { Camp, Registration, Student, StudentProfileView, PublicSettings } from '../types'
import { hasValidEmergencyContacts } from './auth'
import { formatTaipei, nowInTaipei, registrationWindowStatus } from './time'

export type VFailCode = 'GRADE' | 'FULL' | 'CONFLICT' | 'GROUP' | 'DUP' | 'WAITLISTED' | 'CONTACT' | 'WINDOW' | 'LOCKED'
/** ok + waitlist:true 代表「可報名，但名額已滿，將排入候補」 */
export type VResult = { ok: true; waitlist?: boolean } | { ok: false; code: VFailCode; message: string }

export const md = (d: string) => { const [, m, x] = d.split('-'); return `${+m}/${+x}` }
const overlap = (a: Camp, b: Camp) => a.start_time < b.end_time && b.start_time < a.end_time

/** existingRegistrations = 全校所有報名紀錄（用來算名額與學生既有報名） */
export function validateRegistration(
  student: Student,
  target: Camp,
  targetDate: string,
  existingRegistrations: Registration[],
  allCamps: Camp[],
  opts?: { profile?: StudentProfileView | null; settings?: PublicSettings | null; now?: Date },
): VResult {
  const fail = (code: VFailCode, message: string): VResult => ({ ok: false, code, message })

  const win = registrationWindowStatus(opts?.settings?.registration_start_at, opts?.settings?.registration_end_at, opts?.now ?? nowInTaipei())
  if (win.status === 'before') {
    return fail('WINDOW', `尚未開放報名（開放時間：${formatTaipei(win.startAt)}）`)
  }
  if (win.status === 'after') {
    return fail('WINDOW', '報名已截止')
  }

  if (opts?.profile && !hasValidEmergencyContacts(opts.profile)) {
    return fail('CONTACT', '請先至『緊急聯絡人資料』分頁填寫完整聯絡人姓名與電話，才可進行營隊報名！')
  }

  const camp = (id: string) => allCamps.find(c => c.id === id)
  // 正取與候補都算「有效報名」：用於重複、單日擇一、衝堂檢核，避免候補轉正後才發現衝堂
  const live = existingRegistrations.filter(r => r.status === 'enrolled' || r.status === 'waitlisted')
  const mine = live.filter(r => r.student_id === student.student_id)
  if (!target.allowed_grades.includes(student.grade)) return fail('GRADE', '年級不符')
  const dup = mine.find(r => r.camp_id === target.id)
  if (dup) return dup.status === 'waitlisted' ? fail('WAITLISTED', '您已在此營隊的候補名單中') : fail('DUP', '您已報名此營隊')
  if (target.group_id && target.attendance_mode === 'single_day_choice') {
    const og = mine.find(r => camp(r.camp_id)?.group_id === target.group_id)
    const o = og && camp(og.camp_id)
    if (og && o) {
      return fail('GROUP', og.status === 'waitlisted'
        ? `您已排入本活動 ${md(o.dates[0])} 場次的候補名單！若欲改參加 ${md(targetDate)}，請先取消 ${md(o.dates[0])} 的候補後再重新選擇。`
        : `您已報名本活動的 ${md(o.dates[0])} 場次！若欲改參加 ${md(targetDate)}，請先取消 ${md(o.dates[0])} 的報名後再重新選擇。`)
    }
  }
  for (const r of mine) {
    const c = camp(r.camp_id)
    if (!c || !c.dates.some(d => target.dates.includes(d)) || !overlap(c, target)) continue
    const ok = target.ignore_time_conflict || c.ignore_time_conflict || target.allow_concurrent_with.includes(c.id) || c.allow_concurrent_with.includes(target.id)
    if (!ok) return fail('CONFLICT', `與「${c.name}」時段衝堂（${c.start_time}-${c.end_time}）`)
  }
  const enrolled = existingRegistrations.filter(r => r.camp_id === target.id && r.status === 'enrolled').length
  if (enrolled >= target.max_capacity) return { ok: true, waitlist: true }
  return { ok: true }
}

export type BtnKind = 'enroll' | 'waitlist' | 'grade' | 'full' | 'already' | 'waitlisted' | 'contact' | 'window'
/** 前台按鈕狀態：額滿但可候補時顯示「額滿，排入候補」；衝堂與擇一則點擊後顯示提示 */
export const buttonState = (v: VResult): { label: string; disabled: boolean; kind: BtnKind } =>
  v.ok ? (v.waitlist ? { label: '額滿，排入候補', disabled: false, kind: 'waitlist' } : { label: '報名', disabled: false, kind: 'enroll' })
  : v.code === 'GRADE' ? { label: '年級不符', disabled: true, kind: 'grade' }
  : v.code === 'FULL' ? { label: '已額滿', disabled: true, kind: 'full' }
  : v.code === 'DUP' ? { label: '已報名', disabled: true, kind: 'already' }
  : v.code === 'WAITLISTED' ? { label: '候補中', disabled: true, kind: 'waitlisted' }
  : v.code === 'CONTACT' ? { label: '請先填聯絡人', disabled: true, kind: 'contact' }
  : v.code === 'WINDOW' ? { label: v.message.includes('截止') ? '報名已截止' : '尚未開放', disabled: true, kind: 'window' }
  : { label: '報名', disabled: false, kind: 'enroll' }

/** 實際應出席天數（營隊日期數；單日擇一視為 1 天） */
export function attendingDays(camp: Camp): number {
  if (camp.attendance_mode === 'single_day_choice') return 1
  return camp.dates.length
}

/** 是否允許請假：應出席天數 >= 2 */
export function canRequestLeave(camp: Camp): boolean {
  return attendingDays(camp) >= 2
}

export function canCancelOrEnroll(settings?: PublicSettings | null, now = nowInTaipei()): boolean {
  const win = registrationWindowStatus(settings?.registration_start_at, settings?.registration_end_at, now)
  return win.status === 'open' || win.status === 'unset'
}
