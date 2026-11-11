import { describe, expect, it } from 'vitest'
import { Camp, Registration } from '../types'
import { canPromote, enrolledCount, seatsLeft, waitlistOf, waitlistPosition } from './waitlist'
const camp = { id: 'a', max_capacity: 2 } as Camp
const r = (id: string, status: Registration['status'], created_at: string, camp_id = 'a'): Registration =>
  ({ id, student_id: id, camp_id, status, created_at })
describe('waitlist', () => {
  const regs = [r('e1', 'enrolled', '2026-07-01T00:00:00Z'), r('w2', 'waitlisted', '2026-07-03T00:00:00Z'), r('w1', 'waitlisted', '2026-07-02T00:00:00Z'),
    r('x', 'cancelled', '2026-07-01T00:00:00Z'), r('o', 'waitlisted', '2026-07-01T00:00:00Z', 'other')]
  it('依報名時間排序，且只含該營隊', () => { expect(waitlistOf('a', regs).map(x => x.id)).toEqual(['w1', 'w2']) })
  it('候補順位', () => { expect(waitlistPosition(regs[2], regs)).toBe(1); expect(waitlistPosition(regs[1], regs)).toBe(2); expect(waitlistPosition(regs[0], regs)).toBe(0) })
  it('名額與遞補條件：滿額不可轉正，有人取消後可轉正', () => {
    expect(enrolledCount('a', regs)).toBe(1); expect(seatsLeft(camp, regs)).toBe(1); expect(canPromote(camp, regs)).toBe(true)
    const full = [...regs, r('e2', 'enrolled', '2026-07-01T00:00:00Z')]
    expect(canPromote(camp, full)).toBe(false)
    expect(canPromote(camp, full.map(x => x.id === 'e2' ? { ...x, status: 'cancelled' as const } : x))).toBe(true)
  })
})
