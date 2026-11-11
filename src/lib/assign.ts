import { Camp, Registration, Student } from '../types'

/** S 型索引：n=2 → 0,1,1,0,0,1,1,0…；n=3 → 0,1,2,2,1,0,0,1,2… */
export function snakeIndex(i: number, n: number): number {
  const round = Math.floor(i / n), pos = i % n
  return round % 2 === 0 ? pos : n - 1 - pos
}

/**
 * 自動分班（年級排序 + S 型分配）：
 * 1) 只取該營隊「正取」學生（候補、已取消不參與）；
 * 2) 依 年級 → 原班級 → 座號 排序（排序固定，結果可重現）；
 * 3) 依子班別順序做 S 型分發（A→B→B→A…），使各班人數相差至多 1，且各年級在各班比例相近。
 * 注意：子班別的 grades 欄位不再參與自動分班（保留作為資料欄位）。回傳完整 regs。
 */
export function autoAssign(camp: Camp, regs: Registration[], students: Student[]): Registration[] {
  const n = camp.sub_classes.length
  if (!n) return regs
  const byId = new Map(students.map(s => [s.student_id, s]))
  const order = regs
    .filter(r => r.camp_id === camp.id && r.status === 'enrolled')
    .map(r => ({ r, s: byId.get(r.student_id) }))
    .sort((a, b) =>
      (a.s?.grade ?? 99) - (b.s?.grade ?? 99)
      || +(a.s?.classCode ?? 0) - +(b.s?.classCode ?? 0)
      || (a.s?.no ?? 0) - (b.s?.no ?? 0)
      || a.r.id.localeCompare(b.r.id))
  const target = new Map<string, string>()
  order.forEach(({ r }, i) => target.set(r.id, camp.sub_classes[snakeIndex(i, n)].id))
  return regs.map(r => {
    const id = target.get(r.id)
    return id && r.assigned_sub_class !== id ? { ...r, assigned_sub_class: id } : r
  })
}
