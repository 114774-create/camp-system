import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Camp, EmergencyContact, PublicSettings, Registration, Student, StudentProfileView,
} from '../types'
import { getRepo } from '../data/repo'
import { loadStudents } from '../services/studentService'
import { validateRegistration, VResult, canCancelOrEnroll, canRequestLeave } from '../lib/validate'
import { autoAssign } from '../lib/assign'
import { canPromote } from '../lib/waitlist'
import { emptyProfileView, readAdminToken } from '../lib/auth'
import type { BindSiblingResult, ResetPasswordResult } from '../types'
import { DUPLICATE_NAME_MESSAGE, findDuplicateNames, normName } from '../lib/name'

const repo = getRepo()

export function useCampData() {
  const [students, setStudents] = useState<Student[]>([])
  const [camps, setCamps] = useState<Camp[]>([])
  const [regs, setRegs] = useState<Registration[]>([])
  /** 僅登入學生自己的個資，或後台驗證後的全校清單（皆不含密碼） */
  const [profiles, setProfiles] = useState<StudentProfileView[]>([])
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [loading, setLoading] = useState(true)
  /** camp_id → 教師 PIN（只在後台驗證後才有） */
  const [teacherPins, setTeacherPins] = useState<Record<string, string>>({})

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

  /** 學號 → 正規化姓名鍵（學號每年會變，密碼與聯絡人以姓名為鍵）。找不到學號回傳空字串 */
  const keyOfId = (studentId: string) => {
    const s = students.find(x => x.student_id === studentId)
    return s ? normName(s.name) : ''
  }
  /** 名單中同名同姓者（姓名是唯一鍵，同名時一律拒絕登入，避免互相看到對方資料） */
  const duplicateNames = useMemo(() => findDuplicateNames(students), [students])

  const getProfile = (studentId: string): StudentProfileView => {
    const key = keyOfId(studentId)
    return profiles.find(p => p.student_name === key) ?? emptyProfileView(key)
  }

  const upsertLocalProfile = (view: StudentProfileView) => {
    setProfiles(prev => prev.some(x => x.student_name === view.student_name)
      ? prev.map(x => x.student_name === view.student_name ? view : x)
      : [...prev, view])
  }

  const requireAdminPassword = () => {
    const pwd = readAdminToken()
    if (!pwd) throw new Error('ADMIN_AUTH_FAILED')
    return pwd
  }

  const noStudent = { success: false as const, remaining_attempts: 5, is_locked: false, message: '查無此學號' }
  const dupFail = { success: false as const, remaining_attempts: 5, is_locked: false, message: DUPLICATE_NAME_MESSAGE }

  const loginStudent = async (studentId: string, password: string) => {
    const key = keyOfId(studentId)
    if (!key) return { ok: false as const, locked: false, attempts: 0, message: noStudent.message }
    if (duplicateNames.includes(key)) return { ok: false as const, locked: false, attempts: 0, message: DUPLICATE_NAME_MESSAGE }
    const result = await repo.verifyStudentLogin(key, password, studentId)
    if (result.success) {
      upsertLocalProfile({ student_name: key, failed_attempts: 0, is_locked: false, emergency_contacts: result.emergency_contacts })
      return { ok: true as const }
    }
    if (result.is_locked) {
      upsertLocalProfile({ student_name: key, failed_attempts: 5, is_locked: true, emergency_contacts: getProfile(studentId).emergency_contacts })
    }
    return { ok: false as const, locked: result.is_locked, attempts: 5 - result.remaining_attempts, message: result.message }
  }

  const changeStudentPassword = async (studentId: string, currentPassword: string, nextPassword: string) => {
    const key = keyOfId(studentId)
    if (!key) return noStudent
    if (duplicateNames.includes(key)) return dupFail
    const result = await repo.updateStudentProfile(key, currentPassword, nextPassword, null, studentId)
    if (!result.success) return result
    upsertLocalProfile({ student_name: key, failed_attempts: 0, is_locked: false, emergency_contacts: result.emergency_contacts })
    return result
  }

  const saveEmergencyContacts = async (studentId: string, currentPassword: string, contacts: EmergencyContact[]) => {
    const key = keyOfId(studentId)
    if (!key) return noStudent
    if (duplicateNames.includes(key)) return dupFail
    const result = await repo.updateStudentProfile(key, currentPassword, null, contacts, studentId)
    if (!result.success) return result
    upsertLocalProfile({ student_name: key, failed_attempts: 0, is_locked: false, emergency_contacts: result.emergency_contacts })
    return result
  }

  const verifyAdmin = async (adminPassword: string) => {
    const bundle = await repo.verifyAdminAndFetchAll(adminPassword)
    setProfiles(bundle.profiles)
    setSettings(bundle.settings)
    setTeacherPins(bundle.teacher_pins)
    // 把目前試算表的學生名單同步進資料庫：首次登入時以此驗證「學號↔姓名」（尚未同步則新生無法登入）
    try {
      await repo.adminSyncRoster(adminPassword, students.map(s => ({ student_id: s.student_id, student_name: s.name })))
    } catch { /* 同步失敗不影響後台登入；學生端首次登入會提示洽行政人員 */ }
    return bundle
  }

  const refreshAdminProfiles = async () => {
    const pwd = requireAdminPassword()
    const bundle = await repo.verifyAdminAndFetchAll(pwd)
    setProfiles(bundle.profiles)
    setSettings(bundle.settings)
    setTeacherPins(bundle.teacher_pins)
    return bundle
  }

  const unlockStudent = async (studentId: string) => {
    const key = keyOfId(studentId)
    if (!key) return
    await repo.adminUnlockStudent(requireAdminPassword(), key, studentId)
    await refreshAdminProfiles()
  }

  /** 重設為預設密碼＝該生「目前的學號」 */
  const resetStudentPassword = async (studentId: string) => {
    const key = keyOfId(studentId)
    if (!key) return
    await repo.adminResetStudentPassword(requireAdminPassword(), key, studentId)
    await refreshAdminProfiles()
  }

  const adminSaveContacts = async (studentId: string, contacts: EmergencyContact[]) => {
    const key = keyOfId(studentId)
    if (!key) return
    await repo.adminSetContacts(requireAdminPassword(), key, contacts, studentId)
    await refreshAdminProfiles()
  }

  const enroll = async (student: Student, camp: Camp): Promise<VResult> => {
    const profile = getProfile(student.student_id)
    const v = validateRegistration(student, camp, camp.dates[0], regs, camps, { profile, settings })
    if (!v.ok) return v
    const base = {
      id: crypto.randomUUID(),
      student_name: normName(student.name),          // 報名紀錄以姓名為鍵（跟著學生走）
      snapshot_student_id: student.student_id,        // 報名當下的學號快照，僅供行政查閱
      camp_id: camp.id,
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
    const r = regs.find(x => x.id === id)
    if (!canCancelOrEnroll(settings, undefined, r ? camps.find(c => c.id === r.camp_id) : null)) {
      return { ok: false, code: 'WINDOW', message: '報名已截止' }
    }
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
    const saved = await repo.adminSaveCamp(requireAdminPassword(), c)
    const { teacher_pin: _pin, ...pub } = c          // 公開狀態中不保留 PIN
    setCamps(p => p.some(x => x.id === c.id) ? p.map(x => x.id === c.id ? pub : x) : [...p, pub])
    if (saved.teacher_pin) setTeacherPins(p => ({ ...p, [c.id]: saved.teacher_pin! }))
  }

  const deleteCamp = async (id: string) => {
    await repo.adminDeleteCamp(requireAdminPassword(), id)
    setCamps(p => p.filter(x => x.id !== id))
    setRegs(p => p.filter(r => r.camp_id !== id))
    setTeacherPins(p => { const { [id]: _gone, ...rest } = p; return rest })
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
      global_alert_message: s.global_alert_message,
      global_alert_active: s.global_alert_active,
    })
    setSettings(next)
  }

  /** 清除記憶體中的個資：不帶參數＝全部；帶姓名鍵＝只清該生 */
  const clearStudentPii = (nameKey?: string | null) => {
    if (!nameKey) {
      setProfiles([])
      return
    }
    setProfiles(prev => prev.filter(p => p.student_name !== nameKey))
  }

  /** 後台：取消某學生所有有效報名（正取與候補），保留紀錄與取消時間 */
  const adminCancelRegistrations = async (studentId: string) => {
    const now = new Date().toISOString()
    const next = regs
      .filter(r => r.student_name === keyOfId(studentId) && (r.status === 'enrolled' || r.status === 'waitlisted'))
      .map(r => ({ ...r, status: 'cancelled' as const, cancelled_at: now }))
    if (!next.length) return
    await repo.upsertRegs(next)
    setRegs(p => p.map(x => next.find(n => n.id === x.id) ?? x))
  }

  /** 後台：讀取老師的點名紀錄 */
  const loadAttendance = () => repo.adminGetAttendance(requireAdminPassword())

  /** 後台：把單一學生移出某營隊的名單（正取或候補皆可）。保留紀錄與取消時間，學生之後可以重新報名 */
  const adminCancelOne = async (regId: string): Promise<VResult> => {
    const r = regs.find(x => x.id === regId)
    if (!r || r.status === 'cancelled') return { ok: false, code: 'DUP', message: '找不到報名紀錄（可能已被移除）' }
    const n = { ...r, status: 'cancelled' as const, cancelled_at: new Date().toISOString() }
    try { await repo.upsertRegs([n]) }
    catch { await reloadPublic(); return { ok: false, code: 'LOCKED', message: '移出失敗，已重新載入資料，請再試一次' } }
    setRegs(p => p.map(x => x.id === regId ? n : x))
    return { ok: true }
  }

  /** 手足綁定：以姓名驗證兩個帳號；B 尚無聯絡人時由伺服器複製 A 的聯絡人 */
  const addSibling = async (a: { id: string; password: string }, b: { id: string; password: string }): Promise<BindSiblingResult> => {
    const na = keyOfId(a.id), nb = keyOfId(b.id)
    if (!na || !nb) return { success: false, message: '查無此學號' }
    if (duplicateNames.includes(na) || duplicateNames.includes(nb)) return { success: false, message: DUPLICATE_NAME_MESSAGE }
    const r = await repo.bindSibling({ name: na, id: a.id, password: a.password }, { name: nb, id: b.id, password: b.password })
    if (r.success) {
      upsertLocalProfile({ student_name: nb, failed_attempts: 0, is_locked: false, emergency_contacts: r.emergency_contacts })
    } else if (r.is_locked && r.who === 'B') {
      upsertLocalProfile({ student_name: nb, failed_attempts: 5, is_locked: true, emergency_contacts: getProfile(b.id).emergency_contacts })
    }
    return r
  }

  /** 忘記密碼：輸入學號 → 查出姓名 → 以「姓名 + 主要聯絡人電話」驗證 */
  /** newPassword 為 null＝重設回預設密碼（目前學號）；有值＝自訂新密碼 */
  const resetPasswordByPhone = (studentId: string, phone: string, newPassword: string | null): Promise<ResetPasswordResult> => {
    const key = keyOfId(studentId.trim())
    if (!key || duplicateNames.includes(key)) {
      return Promise.resolve({ success: false, message: '驗證失敗：學號或主要聯絡人電話不符。連續錯誤多次將暫停此功能 30 分鐘。' })
    }
    return repo.resetPasswordByPhone(key, phone, newPassword, studentId.trim())
  }

  /** 學生登入成功後：丟棄後台載入的全校個資，只保留該生自己的（以姓名鍵） */
  const keepOnlyProfile = (nameKey: string) => setProfiles(prev => prev.filter(p => p.student_name === nameKey))

  return {
    students, camps, regs, profiles, settings, loading,
    getProfile, loginStudent, changeStudentPassword, saveEmergencyContacts,
    verifyAdmin, unlockStudent, resetStudentPassword, adminSaveContacts,
    enroll, cancel, promoteWaitlist, loadAttendance, adminCancelOne, adminCancelRegistrations, keepOnlyProfile, addSibling, resetPasswordByPhone, teacherPins, duplicateNames, requestLeave, setSubClass, autoAssign: runAutoAssign,
    saveCamp, deleteCamp, saveSettings, reloadPublic, clearStudentPii, refreshAdminProfiles,
  }
}
