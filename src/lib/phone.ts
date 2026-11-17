import { EmergencyContact } from '../types'

/** 存檔用：去除空白、連字號、括號，只留數字 */
export const normalizePhone = (s: string) => s.replace(/[\s\-－()（）]/g, '')

// 手機：09XX-XXXXXX 或 09XXXXXXXX；市話：0X-XXXXXXX（X 為區碼 2～8，後接 7 碼）
const MOBILE = /^09\d{2}-?\d{6}$/
const LANDLINE = /^0[2-8]-?\d{7}$/
export const isValidTwPhone = (s: string) => { const t = s.replace(/\s/g, ''); return MOBILE.test(t) || LANDLINE.test(t) }

// 姓名：只能是中文字或英文字母（英文名字之間可有單一空格），且至少 2 個字
const NAME_RE = /^[\u3400-\u4dbf\u4e00-\u9fffA-Za-z]+(?: [\u3400-\u4dbf\u4e00-\u9fffA-Za-z]+)*$/
export const isValidContactName = (s: string) => { const t = s.trim(); return NAME_RE.test(t) && t.replace(/ /g, '').length >= 2 }
export const isValidContact = (c: Pick<EmergencyContact, 'name' | 'phone'>) => isValidContactName(c.name) && isValidTwPhone(c.phone)

export const PHONE_RULE_ZH = '手機：09XX-XXXXXX 或 09XXXXXXXX；市話：0X-XXXXXXX'
export const NAME_RULE_ZH = '姓名至少 2 個字，且只能是中文或英文字母'

/** 檢查（已排除全空白列的）聯絡人清單，回傳所有問題；空陣列代表通過 */
export function contactIssues(list: EmergencyContact[]): string[] {
  const out: string[] = []
  list.forEach((c, i) => {
    const n = `#${i + 1}`
    if (!isValidContactName(c.name)) out.push(`${n} ${NAME_RULE_ZH}`)
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
