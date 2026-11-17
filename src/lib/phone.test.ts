import { describe, expect, it } from 'vitest'
import { cleanContacts, contactIssues, isValidContact, isValidContactName, isValidTwPhone, normalizePhone } from './phone'
const c = (name: string, phone: string, p = false) => ({ name, relation: '', phone, is_primary: p })
describe('電話檢核（嚴格）', () => {
  it('手機：09XX-XXXXXX 或 09XXXXXXXX', () => {
    for (const ok of ['0912345678', '0912-345678']) expect(isValidTwPhone(ok)).toBe(true)
    for (const bad of ['0923456781000', '091234567', '0812345678', '912345678', '09123456789', '0912-345-678', '09-12345678', 'abc']) expect(isValidTwPhone(bad)).toBe(false)
  })
  it('市話：0X-XXXXXXX（區碼 2～8 + 7 碼）；單純 7 碼不再通過', () => {
    for (const ok of ['06-1234567', '061234567', '02-1234567']) expect(isValidTwPhone(ok)).toBe(true)
    for (const bad of ['1234567', '123-4567', '01-1234567', '09-1234567', '06-123456', '06-12345678', '']) expect(isValidTwPhone(bad)).toBe(false)
  })
  it('姓名：≥2 字、只能中英文字母（英文名可含單一空格），禁止數字與符號', () => {
    for (const ok of ['王小明', '王OO', 'Mary Chen', 'Li']) expect(isValidContactName(ok)).toBe(true)
    for (const bad of ['', '王', '1', 'test1', '王小明2', 'a', '王-明', '王@明', 'Mary  Chen', '父/母']) expect(isValidContactName(bad)).toBe(false)
  })
  it('聯絡人檢核：姓名與電話都要合規', () => {
    expect(contactIssues([c('王OO', '0912345678')])).toEqual([])
    expect(contactIssues([c('1', '0912345678')])[0]).toContain('姓名')
    expect(contactIssues([c('test1', '0912345678')])[0]).toContain('姓名')
    expect(contactIssues([c('王小明', '')])[0]).toContain('請填寫電話')
    expect(contactIssues([c('王小明', '0923456781000')])[0]).toContain('09XX-XXXXXX')
    expect(isValidContact(c('王小明', '06-1234567'))).toBe(true)
  })
  it('整理：電話轉純數字、自動補主要聯絡人', () => {
    const out = cleanContacts([c(' 王小明 ', '0912-345678'), c('李小華', '06-1234567')])
    expect(out.map(x => [x.name, x.phone, x.is_primary])).toEqual([['王小明', '0912345678', true], ['李小華', '061234567', false]])
    expect(normalizePhone('(06) 123-4567')).toBe('061234567')
  })
})
