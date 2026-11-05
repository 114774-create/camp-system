import { Camp, Registration, Student } from '../types'
/** 自動分班：優先依子班 grades 規則，其餘輪流平均分配。回傳完整 regs（僅該營隊有效報名被更新） */
export function autoAssign(camp: Camp, regs: Registration[], students: Student[]): Registration[] {
  if (!camp.sub_classes.length) return regs
  const load: Record<string, number> = Object.fromEntries(camp.sub_classes.map(s => [s.id, 0]))
  return regs.map(r => {
    if (r.camp_id !== camp.id || r.status !== 'enrolled') return r
    const s = students.find(x => x.student_id === r.student_id)
    const rule = s && camp.sub_classes.find(x => x.grades?.includes(s.grade))
    const pick = rule ?? camp.sub_classes.reduce((a, b) => (load[b.id] < load[a.id] ? b : a))
    load[pick.id]++
    return { ...r, assigned_sub_class: pick.id }
  })
}
