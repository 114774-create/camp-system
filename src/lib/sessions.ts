import { Camp } from '../types'

export const newGroupId = () => `sd-${Math.random().toString(36).slice(2, 8)}`
export type BuildResult = { ok: true; camps: Camp[] } | { ok: false; error: string }

/**
 * 把表單內容轉成要儲存的營隊清單：
 * - 全程參加：1 筆，包含所有日期。
 * - 單日擇一：每個日期各 1 筆（dates 只有 1 天），共用同一個 group_id，
 *   且每筆各自帶 max_capacity —— 即「每一場次人數上限」。群組代碼留空會自動產生。
 * 編輯既有營隊時：原營隊 id 保留給 originalDate（不在清單內則給第一天），其餘日期新增為同群組場次。
 */
export function buildCamps(
  form: Camp,
  dates: string[],
  opts: { originalDate?: string; newId?: () => string; newGroup?: () => string } = {},
): BuildResult {
  const ds = [...new Set(dates)].sort()
  if (!form.name.trim()) return { ok: false, error: '請填寫營隊名稱' }
  if (!ds.length) return { ok: false, error: '請選擇至少一個上課日期' }
  if (!Number.isInteger(form.max_capacity) || form.max_capacity < 1) return { ok: false, error: '人數上限必須是 1 以上的整數' }
  if (!form.allowed_grades.length) return { ok: false, error: '請至少開放一個年級' }
  const newId = opts.newId ?? (() => crypto.randomUUID())

  if (form.attendance_mode === 'full_course') {
    return { ok: true, camps: [{ ...form, id: form.id || newId(), dates: ds, group_id: undefined }] }
  }
  const group = form.group_id?.trim() || (opts.newGroup ?? newGroupId)()
  const keep = form.id ? (opts.originalDate && ds.includes(opts.originalDate) ? opts.originalDate : ds[0]) : undefined
  return {
    ok: true,
    camps: ds.map(d => ({ ...form, id: form.id && d === keep ? form.id : newId(), dates: [d], group_id: group })),
  }
}
