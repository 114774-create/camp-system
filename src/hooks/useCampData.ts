import { useCallback, useEffect, useState } from 'react'
import { Camp, EmergencyContact, Registration, Student, StudentProfile, SystemSettings } from '../types'
import { ensureProfile, getRepo } from '../data/repo'
import { loadStudents } from '../services/studentService'
import { validateRegistration, VResult, canCancelOrEnroll, canRequestLeave } from '../lib/validate'
import { autoAssign } from '../lib/assign'
import { attemptStudentLogin, unlockAndResetPassword } from '../lib/auth'

const repo = getRepo()

export function useCampData() {
  const [students, setStudents] = useState<Student[]>([])
  const [camps, setCamps] = useState<Camp[]>([])
  const [regs, setRegs] = useState<Registration[]>([])
  const [profiles, setProfiles] = useState<StudentProfile[]>([])
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const [s, c, r, p, st] = await Promise.all([
      loadStudents(),
      repo.listCamps(),
      repo.listRegs(),
      repo.listProfiles(),
      repo.getSettings(),
    ])
    setStudents(s)
    setCamps(c)
    setRegs(r)
    setProfiles(p)
    setSettings(st)
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const getProfile = (studentId: string) => ensureProfile(profiles, studentId)

  const persistProfile = async (p: StudentProfile) => {
    await repo.saveProfile(p)
    setProfiles(prev => prev.some(x => x.student_id === p.student_id)
      ? prev.map(x => x.student_id === p.student_id ? p : x)
      : [...prev, p])
  }

  const loginStudent = async (studentId: string, password: string) => {
    const current = getProfile(studentId)
    const { result, profile } = attemptStudentLogin(current, password)
    await persistProfile(profile)
    return result
  }

  const changeStudentPassword = async (studentId: string, nextPassword: string) => {
    const p = { ...getProfile(studentId), password_hash: nextPassword, failed_attempts: 0 }
    await persistProfile(p)
  }

  const saveEmergencyContacts = async (studentId: string, contacts: EmergencyContact[]) => {
    const p = { ...getProfile(studentId), emergency_contacts: contacts }
    await persistProfile(p)
  }

  const unlockStudent = async (studentId: string) => {
    await persistProfile(unlockAndResetPassword(getProfile(studentId)))
  }

  const resetStudentPassword = async (studentId: string) => {
    await persistProfile(unlockAndResetPassword(getProfile(studentId)))
  }

  const enroll = async (student: Student, camp: Camp): Promise<VResult> => {
    const profile = getProfile(student.student_id)
    const v = validateRegistration(student, camp, camp.dates[0], regs, camps, { profile, settings })
    if (!v.ok) return v
    const r: Registration = {
      id: crypto.randomUUID(),
      student_id: student.student_id,
      camp_id: camp.id,
      status: 'enrolled',
      created_at: new Date().toISOString(),
      leave_dates: [],
    }
    try {
      await repo.upsertRegs([r])
    } catch {
      await reload()
      return { ok: false, code: 'FULL', message: '報名失敗，名額可能剛被報滿，請重新確認' }
    }
    setRegs(p => [...p, r])
    return v
  }

  const cancel = async (id: string): Promise<VResult> => {
    if (!canCancelOrEnroll(settings)) {
      return { ok: false, code: 'WINDOW', message: '報名已截止' }
    }
    const r = regs.find(x => x.id === id)
    if (!r) return { ok: false, code: 'DUP', message: '找不到報名紀錄' }
    const n = { ...r, status: 'cancelled' as const, cancelled_at: new Date().toISOString() }
    await repo.upsertRegs([n])
    setRegs(p => p.map(x => x.id === id ? n : x))
    return { ok: true }
  }

  const requestLeave = async (regId: string, leaveDates: string[], reason: string): Promise<VResult> => {
    const r = regs.find(x => x.id === regId)
    if (!r || r.status !== 'enrolled') return { ok: false, code: 'DUP', message: '找不到報名紀錄' }
    const camp = camps.find(c => c.id === r.camp_id)
    if (!camp) return { ok: false, code: 'DUP', message: '找不到營隊' }
    if (!canRequestLeave(camp)) {
      return {
        ok: false,
        code: 'LOCKED',
        message: '單日營隊無法請假，若當天無法出席請直接『取消報名』以釋出名額',
      }
    }
    const valid = leaveDates.filter(d => camp.dates.includes(d))
    if (!valid.length) return { ok: false, code: 'LOCKED', message: '請選擇請假日期' }
    const n: Registration = { ...r, leave_dates: valid, leave_reason: reason }
    await repo.upsertRegs([n])
    setRegs(p => p.map(x => x.id === regId ? n : x))
    return { ok: true }
  }

  const setSubClass = async (id: string, sc: string) => {
    const n = { ...regs.find(x => x.id === id)!, assigned_sub_class: sc || undefined }
    await repo.upsertRegs([n])
    setRegs(p => p.map(x => x.id === id ? n : x))
  }

  const runAutoAssign = async (campId: string) => {
    const camp = camps.find(c => c.id === campId)!
    const next = autoAssign(camp, regs, students)
    await repo.upsertRegs(next.filter((r, i) => r !== regs[i]))
    setRegs(next)
  }

  const saveCamp = async (c: Camp) => {
    await repo.saveCamp(c)
    setCamps(p => p.some(x => x.id === c.id) ? p.map(x => x.id === c.id ? c : x) : [...p, c])
  }

  const deleteCamp = async (id: string) => {
    await repo.deleteCamp(id)
    setCamps(p => p.filter(x => x.id !== id))
    setRegs(p => p.filter(r => r.camp_id !== id))
  }

  const saveSettings = async (s: SystemSettings) => {
    await repo.saveSettings(s)
    setSettings(s)
  }

  return {
    students, camps, regs, profiles, settings, loading,
    getProfile, loginStudent, changeStudentPassword, saveEmergencyContacts,
    unlockStudent, resetStudentPassword,
    enroll, cancel, requestLeave, setSubClass, autoAssign: runAutoAssign,
    saveCamp, deleteCamp, saveSettings, reload,
  }
}
