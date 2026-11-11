import { useCallback, useEffect, useState } from 'react'
import {
  Camp, EmergencyContact, PublicSettings, Registration, Student, StudentProfileView,
} from '../types'
import { getRepo } from '../data/repo'
import { loadStudents } from '../services/studentService'
import { validateRegistration, VResult, canCancelOrEnroll, canRequestLeave } from '../lib/validate'
import { autoAssign } from '../lib/assign'
import { canPromote } from '../lib/waitlist'
import { emptyProfileView, readAdminToken } from '../lib/auth'

const repo = getRepo()

export function useCampData() {
  const [students, setStudents] = useState<Student[]>([])
  const [camps, setCamps] = useState<Camp[]>([])
  const [regs, setRegs] = useState<Registration[]>([])
  /** 僅登入學生自己的個資，或後台驗證後的全校清單（皆不含密碼） */
  const [profiles, setProfiles] = useState<StudentProfileView[]>([])
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const reloadPublic = useCallback(async () => {
    const [s, c, r, st] = await Promise.all([
      loadStudents(),
      repo.listCamps(),
      repo.listRegs(),
      repo.getPublicSettings(),
    ])
    setStudents(s)
    setCamps(c)
    setRegs(r)
    setSettings(st)
    setLoading(false)
  }, [])

  useEffect(() => { reloadPublic() }, [reloadPublic])

  const getProfile = (studentId: string): StudentProfileView =>
    profiles.find(p => p.student_id === studentId) ?? emptyProfileView(studentId)

  const upsertLocalProfile = (view: StudentProfileView) => {
    setProfiles(prev => prev.some(x => x.student_id === view.student_id)
      ? prev.map(x => x.student_id === view.student_id ? view : x)
      : [...prev, view])
  }

  const requireAdminPassword = () => {
    const pwd = readAdminToken()
    if (!pwd) throw new Error('ADMIN_AUTH_FAILED')
    return pwd
  }

  const loginStudent = async (studentId: string, password: string) => {
    const result = await repo.verifyStudentLogin(studentId, password)
    if (result.success) {
      upsertLocalProfile({
        student_id: studentId,
        failed_attempts: 0,
        is_locked: false,
        emergency_contacts: result.emergency_contacts,
      })
      return { ok: true as const }
    }
    if (result.is_locked) {
      upsertLocalProfile({
        student_id: studentId,
        failed_attempts: 5,
        is_locked: true,
        emergency_contacts: getProfile(studentId).emergency_contacts,
      })
    }
    return {
      ok: false as const,
      locked: result.is_locked,
      attempts: 5 - result.remaining_attempts,
      message: result.message,
    }
  }

  const changeStudentPassword = async (studentId: string, currentPassword: string, nextPassword: string) => {
    const result = await repo.updateStudentProfile(studentId, currentPassword, nextPassword, null)
    if (!result.success) return result
    upsertLocalProfile({
      student_id: studentId,
      failed_attempts: 0,
      is_locked: false,
      emergency_contacts: result.emergency_contacts,
    })
    return result
  }

  const saveEmergencyContacts = async (studentId: string, currentPassword: string, contacts: EmergencyContact[]) => {
    const result = await repo.updateStudentProfile(studentId, currentPassword, null, contacts)
    if (!result.success) return result
    upsertLocalProfile({
      student_id: studentId,
      failed_attempts: 0,
      is_locked: false,
      emergency_contacts: result.emergency_contacts,
    })
    return result
  }

  const verifyAdmin = async (adminPassword: string) => {
    const bundle = await repo.verifyAdminAndFetchAll(adminPassword)
    setProfiles(bundle.profiles)
    setSettings(bundle.settings)
    return bundle
  }

  const refreshAdminProfiles = async () => {
    const pwd = requireAdminPassword()
    const bundle = await repo.verifyAdminAndFetchAll(pwd)
    setProfiles(bundle.profiles)
    setSettings(bundle.settings)
    return bundle
  }

  const unlockStudent = async (studentId: string) => {
    await repo.adminUnlockStudent(requireAdminPassword(), studentId)
    await refreshAdminProfiles()
  }

  const resetStudentPassword = async (studentId: string) => {
    await repo.adminResetStudentPassword(requireAdminPassword(), studentId)
    await refreshAdminProfiles()
  }

  const adminSaveContacts = async (studentId: string, contacts: EmergencyContact[]) => {
    await repo.adminSetContacts(requireAdminPassword(), studentId, contacts)
    await refreshAdminProfiles()
  }

  const enroll = async (student: Student, camp: Camp): Promise<VResult> => {
    const profile = getProfile(student.student_id)
    const v = validateRegistration(student, camp, camp.dates[0], regs, camps, { profile, settings })
    if (!v.ok) return v
    const base = {
      id: crypto.randomUUID(), student_id: student.student_id, camp_id: camp.id,
      created_at: new Date().toISOString(), leave_dates: [] as string[],
    }
    let r: Registration = { ...base, status: v.waitlist ? 'waitlisted' : 'enrolled' }
    try {
      await repo.upsertRegs([r])
    } catch {
      // 前端以為有名額、但資料庫已被搶滿（CAMP_FULL）→ 改排入候補
      if (r.status === 'enrolled') {
        r = { ...r, status: 'waitlisted' }
        try { await repo.upsertRegs([r]) } catch { await reloadPublic(); return { ok: false, code: 'FULL', message: '報名失敗，請重新整理後再試' } }
      } else {
        await reloadPublic()
        return { ok: false, code: 'FULL', message: '報名失敗，請重新整理後再試' }
      }
    }
    setRegs(p => [...p, r])
    return r.status === 'waitlisted' ? { ok: true, waitlist: true } : { ok: true }
  }

  const cancel = async (id: string): Promise<VResult> => {
    if (!canCancelOrEnroll(settings)) {
      return { ok: false, code: 'WINDOW', message: '報名已截止' }
    }
    const r = regs.find(x => x.id === id)
    if (!r || r.status === 'cancelled') return { ok: false, code: 'DUP', message: '找不到報名紀錄' }
    const n = { ...r, status: 'cancelled' as const, cancelled_at: new Date().toISOString() }
    await repo.upsertRegs([n])
    setRegs(p => p.map(x => x.id === id ? n : x))
    return { ok: true }
  }

  /** 後台：候補遞補轉正（名額不足時拒絕） */
  const promoteWaitlist = async (regId: string): Promise<VResult> => {
    const r = regs.find(x => x.id === regId)
    if (!r || r.status !== 'waitlisted') return { ok: false, code: 'DUP', message: '找不到候補紀錄' }
    const camp = camps.find(c => c.id === r.camp_id)
    if (!camp) return { ok: false, code: 'DUP', message: '找不到營隊' }
    if (!canPromote(camp, regs)) return { ok: false, code: 'FULL', message: '目前沒有空缺，請等有人取消，或先調高名額上限' }
    try { await repo.adminPromoteWaitlist(requireAdminPassword(), regId) }
    catch { await reloadPublic(); return { ok: false, code: 'FULL', message: '遞補失敗：名額已被占用或權限不足，已重新載入資料' } }
    setRegs(p => p.map(x => x.id === regId ? { ...x, status: 'enrolled' as const } : x))
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
    await repo.adminSaveCamp(requireAdminPassword(), c)
    setCamps(p => p.some(x => x.id === c.id) ? p.map(x => x.id === c.id ? c : x) : [...p, c])
  }

  const deleteCamp = async (id: string) => {
    await repo.adminDeleteCamp(requireAdminPassword(), id)
    setCamps(p => p.filter(x => x.id !== id))
    setRegs(p => p.filter(r => r.camp_id !== id))
  }

  const saveSettings = async (
    s: PublicSettings,
    newAdminPassword?: string,
  ) => {
    const next = await repo.adminSaveSettings(requireAdminPassword(), {
      term_name: s.term_name,
      registration_start_at: s.registration_start_at,
      registration_end_at: s.registration_end_at,
      new_admin_password: newAdminPassword,
    })
    setSettings(next)
  }

  const clearStudentPii = (studentId?: string | null) => {
    if (!studentId) {
      setProfiles([])
      return
    }
    setProfiles(prev => prev.filter(p => p.student_id !== studentId))
  }

  /** 學生登入成功後：丟棄後台載入的全校個資，只保留該生自己的 */
  const keepOnlyProfile = (studentId: string) => setProfiles(prev => prev.filter(p => p.student_id === studentId))

  return {
    students, camps, regs, profiles, settings, loading,
    getProfile, loginStudent, changeStudentPassword, saveEmergencyContacts,
    verifyAdmin, unlockStudent, resetStudentPassword, adminSaveContacts,
    enroll, cancel, promoteWaitlist, keepOnlyProfile, requestLeave, setSubClass, autoAssign: runAutoAssign,
    saveCamp, deleteCamp, saveSettings, reloadPublic, clearStudentPii, refreshAdminProfiles,
  }
}
