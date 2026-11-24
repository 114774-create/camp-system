import { describe, expect, it } from 'vitest'
import { findDuplicateNames, nameKey, normName } from './name'
describe('姓名正規化', () => {
  it('去除所有全形／半形空白（含 Tab、NBSP、全形空白）', () => {
    expect(normName('王 小明')).toBe('王小明')
    expect(normName('　王　小　明　')).toBe('王小明')
    expect(normName('王\u00a0小\t明\n')).toBe('王小明')
    expect(normName('Mary  Chen')).toBe('MaryChen')
    expect(normName(null)).toBe(''); expect(normName(undefined)).toBe('')
    expect(nameKey({ name: ' 李 小華 ' })).toBe('李小華')
  })
  it('找出正規化後同名的學生（空白差異也算同名）', () => {
    expect(findDuplicateNames([{ name: '王小明' }, { name: '王 小明' }, { name: '李小華' }, { name: '' }, { name: ' ' }])).toEqual(['王小明'])
    expect(findDuplicateNames([{ name: '王小明' }, { name: '李小華' }])).toEqual([])
  })
})
