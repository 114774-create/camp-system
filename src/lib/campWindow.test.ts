import { describe, expect, it } from 'vitest'
import { Camp, PublicSettings } from '../types'
import { aggregateWindowStatus, campWindow, campWindowStatus } from './time'
import { canCancelOrEnroll, isSummerCamp, validateRegistration } from './validate'

const T = (s: string) => new Date(s)  // 含時區的 ISO
const settings = (a: string, b: string): PublicSettings => ({ id: 's', registration_start_at: a, registration_end_at: b, term_name: '', global_alert_message: '', global_alert_active: false })
const mk = (o: Partial<Camp>): Camp => ({ id: 'x', term: 'T', season: 'holiday', name: 'X', attendance_mode: 'full_course', dates: ['2026-12-05'], start_time: '09:00', end_time: '12:00', allowed_grades: [1, 2, 3, 4, 5, 6], max_capacity: 10, ignore_time_conflict: false, allow_concurrent_with: [], has_sub_classes: false, sub_classes: [], location: '', teacher: '', notes: '', ...o })
const DEF = settings('2026-11-18T08:00:00Z', '2026-12-01T15:59:00Z')

describe('每個營隊自己的報名時間', () => {
  it('營隊沒設定 → 沿用系統預設；有設定 → 用自己的；只填一端另一端沿用預設', () => {
    expect(campWindow(mk({}), DEF)).toEqual({ startAt: DEF.registration_start_at, endAt: DEF.registration_end_at })
    expect(campWindow(mk({ registration_start_at: 'A', registration_end_at: 'B' }), DEF)).toEqual({ startAt: 'A', endAt: 'B' })
    expect(campWindow(mk({ registration_end_at: 'B' }), DEF)).toEqual({ startAt: DEF.registration_start_at, endAt: 'B' })
  })
  it('夏令營已截止、假日營還沒開放：各自判斷', () => {
    const summer = mk({ id: 's', season: 'summer', registration_start_at: '2026-06-01T00:00:00Z', registration_end_at: '2026-06-10T00:00:00Z' })
    const holiday = mk({ id: 'h', registration_start_at: '2026-12-10T00:00:00Z', registration_end_at: '2026-12-20T00:00:00Z' })
    const now = T('2026-11-25T08:00:00Z')
    expect(campWindowStatus(summer, DEF, now).status).toBe('after')
    expect(campWindowStatus(holiday, DEF, now).status).toBe('before')
    expect(canCancelOrEnroll(DEF, now, summer)).toBe(false)
    expect(canCancelOrEnroll(DEF, now, holiday)).toBe(false)
    expect(canCancelOrEnroll(DEF, now, mk({}))).toBe(true)   // 沒個別設定 → 預設時間內開放
  })
  it('validateRegistration 以營隊自己的時間擋下報名', () => {
    const st = { student_id: '30101', grade: 3, classCode: '301', no: 1, name: 'A' }
    const c = mk({ registration_start_at: '2026-12-10T00:00:00Z' })
    const r = validateRegistration(st, c, c.dates[0], [], [c], { settings: DEF, now: T('2026-11-25T08:00:00Z') })
    expect(r).toMatchObject({ ok: false, code: 'WINDOW' })
  })
  it('橫幅代表時間：有開放中的 → 最快截止者；全部沒個別設定 → 與預設相同', () => {
    const now = T('2026-11-25T08:00:00Z')
    expect(aggregateWindowStatus([], DEF, now)).toEqual({ status: 'open', endAt: DEF.registration_end_at })
    expect(aggregateWindowStatus([mk({}), mk({ id: 'y' })], DEF, now)).toEqual({ status: 'open', endAt: DEF.registration_end_at })
    const early = mk({ id: 'e', registration_end_at: '2026-11-30T00:00:00Z' })
    expect(aggregateWindowStatus([mk({}), early], DEF, now)).toEqual({ status: 'open', endAt: '2026-11-30T00:00:00Z' })
    const later = mk({ id: 'l', registration_start_at: '2026-12-10T00:00:00Z', registration_end_at: '2026-12-20T00:00:00Z' })
    expect(aggregateWindowStatus([later], DEF, now).status).toBe('before')
    const closed = mk({ registration_end_at: '2026-11-01T00:00:00Z', registration_start_at: '2026-10-01T00:00:00Z' })
    expect(aggregateWindowStatus([closed], DEF, now).status).toBe('after')
  })
})

describe('夏令營判斷以 season 為準', () => {
  it('假日營的檔期名稱含「夏令營」也不是夏令營（不擋六年級）', () => {
    expect(isSummerCamp({ season: 'holiday', term: '115學年度夏令營' })).toBe(false)
    expect(isSummerCamp({ season: 'summer', term: '隨便' })).toBe(true)
    const st = { student_id: '60101', grade: 6, classCode: '601', no: 1, name: 'G' }
    const c = mk({ season: 'holiday', term: '115學年度夏令營' })
    expect(validateRegistration(st, c, c.dates[0], [], [c], { settings: null }).ok).toBe(true)
  })
})
