import { describe, expect, it } from 'vitest'
import { cleanContacts, contactIssues, isValidTwPhone, normalizePhone } from './phone'
const c = (name: string, phone: string, p = false) => ({ name, relation: '', phone, is_primary: p })
describe('電話檢核', () => {
  it('手機：09 開頭 10 碼（可含連字號／空白）', () => {
    for (const ok of ['0912345678', '0912-345-678', '0912 345 678']) expect(isValidTwPhone(ok)).toBe(true)
    for (const bad of ['0923456781000', '091234567', '0812345678', '912345678', '09123456789']) expect(isValidTwPhone(bad)).toBe(false)
  })
  it('市話：7 碼', () => {
    expect(isValidTwPhone('1234567')).toBe(true); expect(isValidTwPhone('123-4567')).toBe(true)
    for (const bad of ['123456', '12345678', '06-1234567x', '']) expect(isValidTwPhone(bad)).toBe(false)
  })
  it('聯絡人檢核：姓名、電話必填且格式正確', () => {
    expect(contactIssues([c('王OO', '0912345678')])).toEqual([])
    expect(contactIssues([c('', '0912345678')])[0]).toContain('姓名')
    expect(contactIssues([c('王', '')])[0]).toContain('請填寫電話')
    expect(contactIssues([c('王', '0923456781000')])[0]).toContain('10 碼')
  })
  it('整理：電話轉純數字、自動補主要聯絡人', () => {
    const out = cleanContacts([c(' 王 ', '0912-345-678'), c('李', '1234567')])
    expect(out.map(x => [x.name, x.phone, x.is_primary])).toEqual([['王', '0912345678', true], ['李', '1234567', false]])
    expect(normalizePhone('(06) 123-4567')).toBe('061234567')
  })
})
