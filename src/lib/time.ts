/** 取得台灣標準時間 (Asia/Taipei) 的 Date 物件語意用 ISO 字串比對 */
export function nowInTaipei(): Date {
  const s = new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' })
  return new Date(s)
}

export function formatTaipei(iso: string, withSeconds = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
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
  // en-CA → YYYY-MM-DD style parts
  const parts = new Intl.DateTimeFormat('zh-TW', opts).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}/${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`
}

export type RegWindowStatus =
  | { status: 'before'; startAt: string }
  | { status: 'open'; endAt: string }
  | { status: 'after'; endAt: string }
  | { status: 'unset' }

export function registrationWindowStatus(startAt?: string, endAt?: string, now = nowInTaipei()): RegWindowStatus {
  if (!startAt || !endAt) return { status: 'unset' }
  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { status: 'unset' }
  if (now < start) return { status: 'before', startAt }
  if (now > end) return { status: 'after', endAt }
  return { status: 'open', endAt }
}

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
