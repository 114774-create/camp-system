import { EmergencyContact } from '../types'

/** 去除空白、連字號、括號（讓 0912-345-678、(06)123 4567 這類輸入可被判斷） */
export const normalizePhone = (s: string) => s.replace(/[\s\-－()（）]/g, '')
/** 手機：09 開頭共 10 碼；市話：7 碼（不含區碼） */
export const isValidTwPhone = (s: string) => { const p = normalizePhone(s); return /^09\d{8}$/.test(p) || /^\d{7}$/.test(p) }
export const PHONE_RULE_ZH = '手機請輸入 10 碼（09 開頭），市話請輸入 7 碼'

/** 檢查（已排除全空白列的）聯絡人清單，回傳所有問題；空陣列代表通過 */
export function contactIssues(list: EmergencyContact[]): string[] {
  const out: string[] = []
  list.forEach((c, i) => {
    const n = `#${i + 1}`
    if (!c.name.trim()) out.push(`${n} 請填寫聯絡人姓名`)
    if (!c.phone.trim()) out.push(`${n} 請填寫電話`)
    else if (!isValidTwPhone(c.phone)) out.push(`${n} 電話格式不正確：${PHONE_RULE_ZH}`)
  })
  return out
}
/** 存檔前整理：去頭尾空白、電話只留數字，並確保有一位主要聯絡人 */
export function cleanContacts(list: EmergencyContact[]): EmergencyContact[] {
  const out = list.map(c => ({ ...c, name: c.name.trim(), relation: c.relation.trim(), phone: normalizePhone(c.phone) }))
  if (out.length && !out.some(c => c.is_primary)) out[0].is_primary = true
  return out
}
