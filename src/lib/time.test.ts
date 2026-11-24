import { describe, expect, it } from 'vitest'
import { computeCountdown, formatTaipei, nowInTaipei, parseTaipeiMs, registrationWindowStatus, splitDuration } from './time'

const U = Date.UTC
// 專案未安裝 node 型別：以 globalThis 取得 process.env
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
describe('台灣時間解析', () => {
  it('有時區照辦；沒有時區一律視為台北時間（UTC+8）', () => {
    const want = U(2026, 10, 27, 15, 59)              // 台北 2026/11/27 23:59 ＝ UTC 15:59
    expect(parseTaipeiMs('2026-11-27T23:59')).toBe(want)
    expect(parseTaipeiMs('2026-11-27 23:59:00')).toBe(want)
    expect(parseTaipeiMs('2026-11-27T23:59:00+08:00')).toBe(want)
    expect(parseTaipeiMs('2026-11-27T15:59:00Z')).toBe(want)
    expect(parseTaipeiMs('2026-11-27T15:59:00.000+00:00')).toBe(want)
    expect(parseTaipeiMs('2026-11-27')).toBe(U(2026, 10, 26, 16, 0))   // 日期 → 台北當天 00:00
  })
  it('空白或無效回傳 null', () => { for (const v of ['', '  ', null, undefined, 'abc', '2026-13-45T99:99']) expect(parseTaipeiMs(v as never)).toBeNull() })
  it('與瀏覽器時區無關（舊版 nowInTaipei 在非台灣時區會偏差數小時）', () => {
    const old = env.TZ
    try {
      env.TZ = 'America/Los_Angeles'
      const want = U(2026, 10, 27, 15, 59)
      expect(new Date('2026-11-27T23:59').getTime()).not.toBe(want)         // 瀏覽器預設解析會用本機時區 → 錯
      expect(parseTaipeiMs('2026-11-27T23:59')).toBe(want)                  // 我們的解析不受影響
      const s = '2026-11-27T15:59:00.000Z'
      expect(registrationWindowStatus('2026-11-01T00:00:00Z', s, want - 1).status).toBe('open')
      expect(registrationWindowStatus('2026-11-01T00:00:00Z', s, want).status).toBe('after')
      expect(Math.abs(nowInTaipei().getTime() - Date.now())).toBeLessThan(1000)   // 「現在」就是絕對時間點，不做牆鐘位移
    } finally { if (old === undefined) delete env.TZ; else env.TZ = old }
  })
  it('顯示一律轉成台北時間', () => {
    expect(formatTaipei('2026-11-27T15:59:00Z')).toBe('2026/11/27 23:59')
    expect(formatTaipei('2026-11-27T23:59')).toBe('2026/11/27 23:59')
    expect(formatTaipei('')).toBe('—')
  })
})
describe('報名時間窗', () => {
  const start = '2026-11-20T00:00:00+08:00', end = '2026-11-27T23:59:00+08:00'
  const s = parseTaipeiMs(start)!, e = parseTaipeiMs(end)!
  it('開放前／開放中／截止後，邊界以毫秒精準：start 當下即開放；end 當下即截止', () => {
    expect(registrationWindowStatus(start, end, s - 1).status).toBe('before')
    expect(registrationWindowStatus(start, end, s).status).toBe('open')
    expect(registrationWindowStatus(start, end, e - 1).status).toBe('open')
    expect(registrationWindowStatus(start, end, e).status).toBe('after')
    expect(registrationWindowStatus(start, end, new Date(e + 5000)).status).toBe('after')
  })
  it('只設定一端也成立；兩端都沒設＝不限制', () => {
    expect(registrationWindowStatus('', end, e + 1).status).toBe('after')
    expect(registrationWindowStatus('', end, e - 1)).toEqual({ status: 'open', endAt: end })
    expect(registrationWindowStatus(start, '', s - 1).status).toBe('before')
    expect(registrationWindowStatus(start, '', s + 1)).toEqual({ status: 'open', endAt: '' })
    expect(registrationWindowStatus('', '', 0).status).toBe('unset')
  })
})
describe('倒數計算', () => {
  it('拆成天／小時／分／秒，並向上取整到秒', () => {
    expect(splitDuration((86400 + 3600 + 60 + 1) * 1000)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 })
    expect(splitDuration(400)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 })
    expect(splitDuration(0).seconds).toBe(0); expect(splitDuration(-5000).seconds).toBe(0)
    expect(splitDuration(59 * 60 * 1000 + 59 * 1000)).toMatchObject({ hours: 0, minutes: 59, seconds: 59 })
  })
  it('歸零的瞬間才算結束；沒有目標時不算結束', () => {
    expect(computeCountdown(10_000, 9_001)).toMatchObject({ isDone: false, seconds: 1, remainingMs: 999 })
    expect(computeCountdown(10_000, 10_000)).toMatchObject({ isDone: true, remainingMs: 0 })
    expect(computeCountdown(10_000, 99_999).isDone).toBe(true)
    expect(computeCountdown(null, 1)).toMatchObject({ isDone: false, hasTarget: false })
  })
})
