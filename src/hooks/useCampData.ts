import { useCallback, useEffect, useState } from 'react'
import { Camp, Registration, Student } from '../types'
import { getRepo } from '../data/repo'
import { loadStudents } from '../services/studentService'
import { validateRegistration, VResult } from '../lib/validate'
import { autoAssign } from '../lib/assign'
const repo = getRepo()
export function useCampData() {
  const [students, setStudents] = useState<Student[]>([])
  const [camps, setCamps] = useState<Camp[]>([])
  const [regs, setRegs] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    const [s, c, r] = await Promise.all([loadStudents(), repo.listCamps(), repo.listRegs()])
    setStudents(s); setCamps(c); setRegs(r); setLoading(false)
  }, [])
  useEffect(() => { reload() }, [reload])
  const enroll = async (student: Student, camp: Camp): Promise<VResult> => {
    const v = validateRegistration(student, camp, camp.dates[0], regs, camps)
    if (!v.ok) return v
    const r: Registration = { id: crypto.randomUUID(), student_id: student.student_id, camp_id: camp.id, status: 'enrolled', created_at: new Date().toISOString() }
    try { await repo.upsertRegs([r]) } catch { await reload(); return { ok: false, code: 'FULL', message: '報名失敗，名額可能剛被報滿，請重新確認' } }
    setRegs(p => [...p, r]); return v
  }
  const cancel = async (id: string) => {
    const r = regs.find(x => x.id === id); if (!r) return
    const n = { ...r, status: 'cancelled' as const, cancelled_at: new Date().toISOString() }
    await repo.upsertRegs([n]); setRegs(p => p.map(x => x.id === id ? n : x))
  }
  const setSubClass = async (id: string, sc: string) => {
    const n = { ...regs.find(x => x.id === id)!, assigned_sub_class: sc || undefined }
    await repo.upsertRegs([n]); setRegs(p => p.map(x => x.id === id ? n : x))
  }
  const runAutoAssign = async (campId: string) => {
    const camp = camps.find(c => c.id === campId)!
    const next = autoAssign(camp, regs, students)
    await repo.upsertRegs(next.filter((r, i) => r !== regs[i])); setRegs(next)
  }
  const saveCamp = async (c: Camp) => { await repo.saveCamp(c); setCamps(p => p.some(x => x.id === c.id) ? p.map(x => x.id === c.id ? c : x) : [...p, c]) }
  const deleteCamp = async (id: string) => { await repo.deleteCamp(id); setCamps(p => p.filter(x => x.id !== id)); setRegs(p => p.filter(r => r.camp_id !== id)) }
  return { students, camps, regs, loading, enroll, cancel, setSubClass, autoAssign: runAutoAssign, saveCamp, deleteCamp }
}
