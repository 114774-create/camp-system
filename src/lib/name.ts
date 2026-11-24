import { Student } from '../types'

/** 姓名鍵：去除所有全形／半形空白（\s 涵蓋 U+3000、U+00A0）。比對與寫入前一律先經過此函式 */
export const normName = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, '')
export const nameKey = (s: { name: string }) => normName(s.name)

/** 名單中「正規化後同名」的姓名（姓名是密碼與聯絡人的唯一鍵，同名會互相看到對方資料） */
export function findDuplicateNames(students: Pick<Student, 'name'>[]): string[] {
  const count = new Map<string, number>()
  for (const s of students) { const k = normName(s.name); if (k) count.set(k, (count.get(k) ?? 0) + 1) }
  return [...count].filter(([, n]) => n > 1).map(([k]) => k)
}
export const DUPLICATE_NAME_MESSAGE = '系統偵測到同名同姓的學生，為避免資料混淆暫時無法登入，請洽學校行政人員。'

/** 姓名鍵 → 目前名單中的學生（含最新學號與班級座號）。同名時取第一位（同名者本來就無法登入／報名） */
export function studentIndex(students: Student[]): Map<string, Student> {
  const m = new Map<string, Student>()
  for (const s of students) { const k = normName(s.name); if (k && !m.has(k)) m.set(k, s) }
  return m
}
