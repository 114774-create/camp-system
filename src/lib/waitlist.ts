import { Camp, Registration } from '../types'
const ts = (r: Registration) => Date.parse(r.created_at)
/** 某營隊的候補名單（依報名時間先後；時間相同或無效時以 id 穩定排序） */
export const waitlistOf = (campId: string, regs: Registration[]) =>
  regs.filter(r => r.camp_id === campId && r.status === 'waitlisted')
    .sort((a, b) => (ts(a) - ts(b)) || a.id.localeCompare(b.id))
/** 候補順位（從 1 開始；不在候補名單回傳 0） */
export const waitlistPosition = (reg: Registration, regs: Registration[]) =>
  waitlistOf(reg.camp_id, regs).findIndex(r => r.id === reg.id) + 1
export const enrolledCount = (campId: string, regs: Registration[]) =>
  regs.filter(r => r.camp_id === campId && r.status === 'enrolled').length
export const seatsLeft = (camp: Camp, regs: Registration[]) => camp.max_capacity - enrolledCount(camp.id, regs)
export const canPromote = (camp: Camp, regs: Registration[]) => seatsLeft(camp, regs) > 0
