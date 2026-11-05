import { describe, expect, it } from 'vitest'
import { Camp, Registration, Student } from '../types'
import { validateRegistration } from './validate'
import { autoAssign } from './assign'

const mk = (o: Partial<Camp>): Camp => ({ id: 'x', term: 'T', season: 'summer', name: 'X', attendance_mode: 'full_course', dates: ['2026-07-06'], start_time: '09:00', end_time: '12:00', allowed_grades: [1, 2, 3, 4, 5, 6], max_capacity: 10, ignore_time_conflict: false, allow_concurrent_with: [], has_sub_classes: false, sub_classes: [], location: '', teacher: '', notes: '', ...o })
const st = (id: string, grade: number): Student => ({ student_id: id, grade, classCode: `${grade}01`, no: 1, name: id })
const reg = (sid: string, cid: string, status: 'enrolled' | 'cancelled' = 'enrolled'): Registration => ({ id: sid + cid, student_id: sid, camp_id: cid, status, created_at: '' })
const code = (r: any) => (r.ok ? 'OK' : r.code)

describe('validateRegistration', () => {
  it('年級不符', () => { const c = mk({ id: 'a', allowed_grades: [1, 2] }); expect(code(validateRegistration(st('s', 5), c, c.dates[0], [], [c]))).toBe('GRADE') })
  it('名額已滿，取消後釋出', () => {
    const c = mk({ id: 'a', max_capacity: 1 })
    expect(code(validateRegistration(st('s2', 1), c, c.dates[0], [reg('s1', 'a')], [c]))).toBe('FULL')
    expect(code(validateRegistration(st('s2', 1), c, c.dates[0], [reg('s1', 'a', 'cancelled')], [c]))).toBe('OK')
  })
  it('時段衝堂，且可由「允許同時參加」放行', () => {
    const a = mk({ id: 'a' }), b = mk({ id: 'b', start_time: '10:00', end_time: '11:00' })
    expect(code(validateRegistration(st('s', 1), b, b.dates[0], [reg('s', 'a')], [a, b]))).toBe('CONFLICT')
    const b2 = { ...b, ignore_time_conflict: true }
    expect(code(validateRegistration(st('s', 1), b2, b2.dates[0], [reg('s', 'a')], [a, b2]))).toBe('OK')
  })
  it('不同日或時間相接不算衝堂', () => {
    const a = mk({ id: 'a' }), b = mk({ id: 'b', start_time: '12:00', end_time: '15:00' }), c = mk({ id: 'c', dates: ['2026-07-07'] })
    expect(code(validateRegistration(st('s', 1), b, b.dates[0], [reg('s', 'a')], [a, b]))).toBe('OK')
    expect(code(validateRegistration(st('s', 1), c, c.dates[0], [reg('s', 'a')], [a, c]))).toBe('OK')
  })
  it('單日擇一：須先取消才能改選，訊息正確', () => {
    const d4 = mk({ id: 'd4', group_id: 'g', attendance_mode: 'single_day_choice', dates: ['2026-11-04'] })
    const d5 = mk({ id: 'd5', group_id: 'g', attendance_mode: 'single_day_choice', dates: ['2026-11-05'] })
    const r = validateRegistration(st('s', 1), d5, d5.dates[0], [reg('s', 'd4')], [d4, d5])
    expect(code(r)).toBe('GROUP')
    expect((r as any).message).toBe('您已報名本活動的 11/4 場次！若欲改參加 11/5，請先取消 11/4 的報名後再重新選擇。')
    expect(code(validateRegistration(st('s', 1), d5, d5.dates[0], [reg('s', 'd4', 'cancelled')], [d4, d5]))).toBe('OK')
  })
  it('單日擇一：各場次名額獨立計算', () => {
    const d4 = mk({ id: 'd4', group_id: 'g', attendance_mode: 'single_day_choice', max_capacity: 1 })
    const d5 = mk({ id: 'd5', group_id: 'g', attendance_mode: 'single_day_choice', dates: ['2026-11-05'], max_capacity: 1 })
    expect(code(validateRegistration(st('s2', 1), d5, d5.dates[0], [reg('s1', 'd4')], [d4, d5]))).toBe('OK')
  })
})
describe('autoAssign', () => {
  it('依年級規則，其餘平均分配', () => {
    const c = mk({ id: 'a', has_sub_classes: true, sub_classes: [{ id: 'A', name: 'A', grades: [1] }, { id: 'B', name: 'B' }] })
    const ss = [st('s1', 1), st('s2', 2), st('s3', 3)]
    const out = autoAssign(c, ss.map(s => reg(s.student_id, 'a')), ss)
    // s1(年級1)→A；其餘依負載平均：s2→B、s3→A
    expect(out.map(r => r.assigned_sub_class)).toEqual(['A', 'B', 'A'])
  })
})
