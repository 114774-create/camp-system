import { describe, expect, it } from 'vitest'
import { Camp } from '../types'
import { buildCamps } from './sessions'
const form = (o: Partial<Camp> = {}): Camp => ({ id: '', term: 'T', season: 'summer', name: '籃球營', attendance_mode: 'single_day_choice', dates: [], start_time: '08:30', end_time: '11:30', allowed_grades: [3, 4, 5, 6], max_capacity: 30, ignore_time_conflict: false, allow_concurrent_with: [], has_sub_classes: false, sub_classes: [], location: '風雨球場', teacher: 'x', notes: '', ...o })
let n = 0; const opts = { newId: () => `id${++n}`, newGroup: () => 'g-auto' }
describe('buildCamps', () => {
  it('單日擇一：多個日期自動拆成每天一筆，共用群組，每筆各有名額上限', () => {
    const r = buildCamps(form(), ['2026-12-12', '2026-12-05'], opts)
    expect(r.ok && r.camps.map(c => [c.dates, c.max_capacity, c.group_id])).toEqual([[['2026-12-05'], 30, 'g-auto'], [['2026-12-12'], 30, 'g-auto']])
    expect(r.ok && new Set(r.camps.map(c => c.id)).size).toBe(2)
  })
  it('使用者填的群組代碼會保留；重複日期只算一次', () => {
    const r = buildCamps(form({ group_id: ' hoop ' }), ['2026-12-05', '2026-12-05'], opts)
    expect(r.ok && r.camps.map(c => c.group_id)).toEqual(['hoop'])
  })
  it('全程參加：維持單筆多日，並清掉群組代碼', () => {
    const r = buildCamps(form({ attendance_mode: 'full_course', group_id: 'x' }), ['2026-12-05', '2026-12-12'], opts)
    expect(r.ok && r.camps).toHaveLength(1)
    expect(r.ok && r.camps[0].dates).toEqual(['2026-12-05', '2026-12-12'])
    expect(r.ok && r.camps[0].group_id).toBeUndefined()
  })
  it('編輯既有場次並新增日期：原 id 留給原日期，其餘新增', () => {
    const r = buildCamps(form({ id: 'old', group_id: 'hoop' }), ['2026-12-05', '2026-12-12'], { ...opts, originalDate: '2026-12-12' })
    expect(r.ok && r.camps.map(c => [c.id === 'old', c.dates[0]])).toEqual([[false, '2026-12-05'], [true, '2026-12-12']])
  })
  it('欄位檢核', () => {
    expect(buildCamps(form({ name: ' ' }), ['2026-12-05']).ok).toBe(false)
    expect(buildCamps(form(), []).ok).toBe(false)
    expect(buildCamps(form({ max_capacity: 0 }), ['2026-12-05']).ok).toBe(false)
    expect(buildCamps(form({ allowed_grades: [] }), ['2026-12-05']).ok).toBe(false)
  })
})

import { duplicateTemplate } from './sessions'
describe('教師 PIN 與一鍵複製', () => {
  it('新增營隊自動產生 4 碼 PIN，所有拆出的場次共用同一組', () => {
    const r = buildCamps(form(), ['2026-12-05', '2026-12-12'], opts)
    expect(r.ok && new Set(r.camps.map(c => c.teacher_pin)).size).toBe(1)
    expect(r.ok && /^\d{4}$/.test(r.camps[0].teacher_pin!)).toBe(true)
  })
  it('自訂 PIN 保留；格式錯誤擋下', () => {
    const ok = buildCamps(form({ teacher_pin: '0420' }), ['2026-12-05'], opts)
    expect(ok.ok && ok.camps[0].teacher_pin).toBe('0420')
    expect(buildCamps(form({ teacher_pin: '12ab' }), ['2026-12-05'], opts).ok).toBe(false)
    expect(buildCamps(form({ teacher_pin: '123' }), ['2026-12-05'], opts).ok).toBe(false)
  })
  it('複製：帶入設定、標題加(複製)、日期清空、群組與 id 清除、新 PIN', () => {
    const src = form({ id: 'old', name: '籃球營', group_id: 'hoop', dates: ['2026-12-05'], max_capacity: 25, notes: '自備水壺',
      allowed_grades: [3, 4], has_sub_classes: true, sub_classes: [{ id: 'A', name: 'A班' }], teacher_pin: '1111' })
    const d = duplicateTemplate(src, '2222')
    expect(d).toMatchObject({ id: '', name: '籃球營 (複製)', dates: [], group_id: undefined, max_capacity: 25, notes: '自備水壺',
      start_time: '08:30', end_time: '11:30', allowed_grades: [3, 4], teacher_pin: '2222' })
    expect(d.sub_classes).toEqual([{ id: 'A', name: 'A班' }])
    expect(d.sub_classes).not.toBe(src.sub_classes)   // 深拷貝，不影響原營隊
    expect(buildCamps(d, []).ok).toBe(false)           // 日期留白 → 必須重新挑選才能儲存
  })
})
