import { describe, expect, it } from 'vitest'
import { ADMIN_SESSION_KEY, ADMIN_TOKEN_KEY } from './auth'
import { activateAdmin, activateStudent, clearStudentSession, StoreLike, STUDENT_KEY_PREFIX } from './session'
const fake = (init: Record<string, string> = {}): StoreLike & { dump: () => Record<string, string> } => {
  const m = new Map(Object.entries(init))
  return {
    get length() { return m.size }, key: i => [...m.keys()][i] ?? null,
    getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k),
    dump: () => Object.fromEntries(m),
  }
}
describe('前後台登入互斥', () => {
  it('後台登入 → 清除 session/local 內的學生登入狀態，並寫入管理員工作階段', () => {
    const session = fake({ [`${STUDENT_KEY_PREFIX}_id`]: '10101', keep: 'x' }), local = fake({ [`${STUDENT_KEY_PREFIX}_pwd`]: 'p', camp_locale: 'en' })
    activateAdmin('2026', { session, local })
    expect(session.dump()).toEqual({ keep: 'x', [ADMIN_SESSION_KEY]: '1', [ADMIN_TOKEN_KEY]: '2026' })
    expect(local.dump()).toEqual({ camp_locale: 'en' })
  })
  it('學生登入 → 清除 session/local 內的管理員權限，不動其他資料', () => {
    const session = fake({ [ADMIN_SESSION_KEY]: '1', [ADMIN_TOKEN_KEY]: 'pw', keep: 'x' }), local = fake({ [ADMIN_SESSION_KEY]: '1' })
    activateStudent({ session, local })
    expect(session.dump()).toEqual({ keep: 'x' }); expect(local.dump()).toEqual({})
  })
  it('clearStudentSession 只清 camp_student 開頭的鍵', () => {
    const session = fake({ camp_student_a: '1', camp_students_b: '2', other: '3' })
    clearStudentSession({ session })
    expect(session.dump()).toEqual({ other: '3' })
  })
})
