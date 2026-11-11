import { ADMIN_SESSION_KEY, ADMIN_TOKEN_KEY } from './auth'

/** 前後台登入互斥：同一瀏覽器同時只能保有一種身分 */
export const STUDENT_KEY_PREFIX = 'camp_student'
export interface StoreLike { length: number; key(i: number): string | null; getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export interface Stores { session?: StoreLike; local?: StoreLike }

function defaults(): Stores {
  const out: Stores = {}
  try { out.session = sessionStorage } catch { /* ignore */ }
  try { out.local = localStorage } catch { /* ignore */ }
  return out
}
const list = (s: Stores) => [s.session, s.local].filter(Boolean) as StoreLike[]

/** 清除所有學生登入殘留（sessionStorage + localStorage 中 camp_student* 開頭的鍵） */
export function clearStudentSession(stores: Stores = defaults()) {
  for (const st of list(stores)) {
    const keys: string[] = []
    for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k && k.startsWith(STUDENT_KEY_PREFIX)) keys.push(k) }
    keys.forEach(k => st.removeItem(k))
  }
}
/** 清除後台管理員登入（兩種 storage 都清） */
export function clearAdminSession(stores: Stores = defaults()) {
  for (const st of list(stores)) { st.removeItem(ADMIN_SESSION_KEY); st.removeItem(ADMIN_TOKEN_KEY) }
}
/** 後台登入成功：先登出學生，再寫入管理員工作階段 */
export function activateAdmin(password: string, stores: Stores = defaults()) {
  clearStudentSession(stores)
  try { stores.session?.setItem(ADMIN_SESSION_KEY, '1'); stores.session?.setItem(ADMIN_TOKEN_KEY, password) } catch { /* ignore */ }
}
/** 學生登入成功：自動登出後台 */
export function activateStudent(stores: Stores = defaults()) { clearAdminSession(stores) }
