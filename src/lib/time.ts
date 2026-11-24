/**
 * 時間比對一律以「絕對時間點（epoch 毫秒）」為準，與瀏覽器所在時區無關；
 * 只有「顯示」才轉成 Asia/Taipei（TST，無日光節約、固定 UTC+8）。
 * （舊版把台北牆鐘塞進本機時區的 Date，再和 ISO 時間點比較，在台灣以外的瀏覽器會偏差數小時。）
 */
export function nowInTaipei(): Date {
  return new Date()
}

const ZONE = /(Z|[+-]\d{2}(:?\d{2})?)$/i
/** 解析時間字串為 epoch 毫秒：有時區（Z／+08:00）照辦；沒有時區（例如手填 2026-11-27T23:59）一律視為台北時間 */
export function parseTaipeiMs(s?: string | null): number | null {
  const t = (s ?? '').trim()
  if (!t) return null
  let iso = t.replace(' ', 'T')
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso += 'T00:00:00'
  if (!ZONE.test(iso)) iso += '+08:00'
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : ms
}

export function formatTaipei(iso: string, withSeconds = false): string {
  const ms = parseTaipeiMs(iso)
  if (ms === null) return '—'
  const d = new Date(ms)
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }
  if (withSeconds) opts.second = '2-digit'
  const parts = new Intl.DateTimeFormat('zh-TW', opts).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}/${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`
}

export type RegWindowStatus =
  | { status: 'before'; startAt: string }
  | { status: 'open'; endAt: string }      // endAt 為空字串＝沒有設定截止時間
  | { status: 'after'; endAt: string }
  | { status: 'unset' }

/**
 * 報名時間窗。start 之前＝before；end（含）之後＝after（與倒數歸零同一瞬間鎖定）。
 * 只設定其中一端也成立（只設截止時間＝到點就鎖）；兩端都沒設＝unset（不限制）。
 */
export function registrationWindowStatus(startAt?: string, endAt?: string, now: Date | number = new Date()): RegWindowStatus {
  const s = parseTaipeiMs(startAt), e = parseTaipeiMs(endAt)
  if (s === null && e === null) return { status: 'unset' }
  const t = typeof now === 'number' ? now : now.getTime()
  if (s !== null && t < s) return { status: 'before', startAt: startAt! }
  if (e !== null && t >= e) return { status: 'after', endAt: endAt! }
  return { status: 'open', endAt: e !== null ? endAt! : '' }
}

export interface DurationParts { days: number; hours: number; minutes: number; seconds: number }
/** 毫秒 → 天／小時／分／秒（向上取整到秒：還剩 0.4 秒仍顯示 1 秒，歸零才算結束） */
export function splitDuration(ms: number): DurationParts {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 }
}
export interface CountdownState extends DurationParts { remainingMs: number; isDone: boolean; hasTarget: boolean }
export function computeCountdown(targetMs: number | null, nowMs: number): CountdownState {
  if (targetMs === null) return { ...splitDuration(0), remainingMs: 0, isDone: false, hasTarget: false }
  const remainingMs = Math.max(0, targetMs - nowMs)
  return { ...splitDuration(remainingMs), remainingMs, isDone: targetMs - nowMs <= 0, hasTarget: true }
}
export const DAY_MS = 24 * 60 * 60 * 1000

/** datetime-local 值 ↔ ISO（以台北本地牆鐘解讀） */
export function toDatetimeLocalValue(iso: string): string {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export function fromDatetimeLocalValue(local: string): string {
  if (!local) return ''
  // 視為台北牆鐘 → 轉 UTC ISO
  const [date, time] = local.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = (time || '00:00').split(':').map(Number)
  // Asia/Taipei 無 DST，固定 UTC+8
  const utc = Date.UTC(y, m - 1, d, hh - 8, mm || 0, 0)
  return new Date(utc).toISOString()
}
