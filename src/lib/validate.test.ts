import { describe, expect, it } from 'vitest'
import { Camp, Registration, Student } from '../types'
import { buttonState, validateRegistration } from './validate'
import { autoAssign } from './assign'

const mk = (o: Partial<Camp>): Camp => ({ id: 'x', term: 'T', season: 'summer', name: 'X', attendance_mode: 'full_course', dates: ['2026-07-06'], start_time: '09:00', end_time: '12:00', allowed_grades: [1, 2, 3, 4, 5, 6], max_capacity: 10, ignore_time_conflict: false, allow_concurrent_with: [], has_sub_classes: false, sub_classes: [], location: '', teacher: '', notes: '', ...o })
const st = (id: string, grade: number): Student => ({ student_id: id, grade, classCode: `${grade}01`, no: 1, name: id })
const reg = (sid: string, cid: string, status: Registration['status'] = 'enrolled'): Registration => ({ id: sid + cid, student_id: sid, camp_id: cid, status, created_at: '' })
const code = (r: any) => (r.ok ? 'OK' : r.code)

describe('validateRegistration', () => {
  it('年級不符', () => { const c = mk({ id: 'a', allowed_grades: [1, 2] }); expect(code(validateRegistration(st('s', 5), c, c.dates[0], [], [c]))).toBe('GRADE') })
  it('名額已滿 → 可排入候補（ok + waitlist），取消後釋出則為正取', () => {
    const c = mk({ id: 'a', max_capacity: 1 })
    expect(validateRegistration(st('s2', 1), c, c.dates[0], [reg('s1', 'a')], [c])).toEqual({ ok: true, waitlist: true })
    expect(validateRegistration(st('s2', 1), c, c.dates[0], [reg('s1', 'a', 'cancelled')], [c])).toEqual({ ok: true })
  })
  it('候補不占名額；重複報名與重複候補有不同代碼', () => {
    const c = mk({ id: 'a', max_capacity: 1 })
    expect(validateRegistration(st('s2', 1), c, c.dates[0], [reg('s1', 'a', 'waitlisted')], [c])).toEqual({ ok: true })
    expect(code(validateRegistration(st('s1', 1), c, c.dates[0], [reg('s1', 'a')], [c]))).toBe('DUP')
    expect(code(validateRegistration(st('s1', 1), c, c.dates[0], [reg('s1', 'a', 'waitlisted')], [c]))).toBe('WAITLISTED')
  })
  it('候補中的營隊也會與其他營隊衝堂（避免轉正時才衝堂）', () => {
    const a = mk({ id: 'a', max_capacity: 1 }), b = mk({ id: 'b' })
    expect(code(validateRegistration(st('s', 1), b, b.dates[0], [reg('s', 'a', 'waitlisted')], [a, b]))).toBe('CONFLICT')
  })
  it('額滿但同時段衝堂 → 先擋衝堂，不排候補', () => {
    const a = mk({ id: 'a' }), b = mk({ id: 'b', max_capacity: 1 })
    expect(code(validateRegistration(st('s2', 1), b, b.dates[0], [reg('s1', 'b'), reg('s2', 'a')], [a, b]))).toBe('CONFLICT')
  })
  it('按鈕狀態：額滿可候補、已候補鎖定', () => {
    expect(buttonState({ ok: true, waitlist: true })).toMatchObject({ label: '額滿，排入候補', disabled: false, kind: 'waitlist' })
    expect(buttonState({ ok: false, code: 'WAITLISTED', message: '' })).toMatchObject({ label: '候補中', disabled: true })
    expect(buttonState({ ok: true })).toMatchObject({ label: '報名', kind: 'enroll' })
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
  it('單日擇一：候補中的場次同樣要先取消才能改選', () => {
    const d4 = mk({ id: 'd4', group_id: 'g', attendance_mode: 'single_day_choice', dates: ['2026-11-04'] })
    const d5 = mk({ id: 'd5', group_id: 'g', attendance_mode: 'single_day_choice', dates: ['2026-11-05'] })
    const r = validateRegistration(st('s', 1), d5, d5.dates[0], [reg('s', 'd4', 'waitlisted')], [d4, d5])
    expect(code(r)).toBe('GROUP')
    expect((r as any).message).toContain('候補')
  })
  it('單日擇一：各場次名額獨立計算', () => {
    const d4 = mk({ id: 'd4', group_id: 'g', attendance_mode: 'single_day_choice', max_capacity: 1 })
    const d5 = mk({ id: 'd5', group_id: 'g', attendance_mode: 'single_day_choice', dates: ['2026-11-05'], max_capacity: 1 })
    expect(code(validateRegistration(st('s2', 1), d5, d5.dates[0], [reg('s1', 'd4')], [d4, d5]))).toBe('OK')
  })
})
describe('autoAssign（年級排序 + S 型分配）', () => {
  const sc = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(65 + i), name: String.fromCharCode(65 + i) }))
  const run = (grades: number[], n: number, extra: Registration[] = []) => {
    const c = mk({ id: 'a', has_sub_classes: true, sub_classes: sc(n) })
    const ss = grades.map((g, i) => st(`s${i + 1}`, g))
    const out = autoAssign(c, [...ss.map(s => reg(s.student_id, 'a')), ...extra], ss)
    return { out, ss }
  }
  it('兩班：A→B→B→A→A→B', () => {
    const { out } = run([1, 1, 2, 2, 3, 3], 2)
    expect(out.map(r => r.assigned_sub_class)).toEqual(['A', 'B', 'B', 'A', 'A', 'B'])
  })
  it('先依年級排序再分配（輸入順序打亂也一樣）', () => {
    const { out, ss } = run([3, 1, 2, 1, 3, 2], 2)
    const byGrade = (g: number) => ss.filter(s => s.grade === g).map(s => out.find(r => r.student_id === s.student_id)!.assigned_sub_class).sort()
    // 每個年級各 2 人，S 型使其一人在 A、一人在 B
    expect([1, 2, 3].map(byGrade)).toEqual([['A', 'B'], ['A', 'B'], ['A', 'B']])
  })
  it('三班：A→B→C→C→B→A→A', () => {
    const { out } = run([1, 1, 1, 2, 2, 2, 3], 3)
    expect(out.map(r => r.assigned_sub_class)).toEqual(['A', 'B', 'C', 'C', 'B', 'A', 'A'])
  })
  it('各班人數相差不超過 1', () => {
    const { out } = run([1, 1, 1, 2, 2, 3, 3, 3, 4, 5, 5, 6, 6], 2)
    const n = (x: string) => out.filter(r => r.assigned_sub_class === x).length
    expect(Math.abs(n('A') - n('B'))).toBeLessThanOrEqual(1)
  })
  it('候補與已取消不分班；沒有子班別時原樣回傳', () => {
    const { out } = run([1, 2], 2, [reg('w', 'a', 'waitlisted'), reg('x', 'a', 'cancelled')])
    expect(out.filter(r => r.status !== 'enrolled').every(r => !r.assigned_sub_class)).toBe(true)
    const none = mk({ id: 'a' }); const regs = [reg('s1', 'a')]
    expect(autoAssign(none, regs, [st('s1', 1)])).toBe(regs)
  })
})
