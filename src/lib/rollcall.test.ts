import { describe, expect, it } from 'vitest'
import { applyMark, buildRows, pickDefaultDate, summarize, todayTaipei } from './rollcall'
import { parseRoute, teacherLink } from './route'
import { addSession, nextActiveId, removeSession, updatePassword } from './siblings'
const stu = (id: string, cls: string, no: number) => ({ student_id: id, grade: +cls[0], classCode: cls, no, name: `N${id}` })
describe('點名簿輔助', () => {
  it('預設日期：今天在上課日→今天；否則最近的未來日；都過了→最後一天', () => {
    expect(pickDefaultDate(['2026-12-12', '2026-12-05'], '2026-12-05')).toBe('2026-12-05')
    expect(pickDefaultDate(['2026-12-05', '2026-12-12'], '2026-12-07')).toBe('2026-12-12')
    expect(pickDefaultDate(['2026-12-05', '2026-12-12'], '2027-01-01')).toBe('2026-12-12')
    expect(todayTaipei(new Date('2026-12-04T17:00:00Z'))).toBe('2026-12-05')   // UTC 17:00 = 台灣隔天 01:00
  })
  it('名單：依班級座號排序、帶入當日狀態與請假，可依分班篩選', () => {
    const roster = [
      { student_id: 'b', assigned_sub_class: 'B', leave_dates: ['2026-12-05'] },
      { student_id: 'a', assigned_sub_class: 'A', leave_dates: [] },
      { student_id: 'z', leave_dates: [] },   // 不在學生名單
    ]
    const marks = [{ student_id: 'a', date: '2026-12-05', status: 'present' as const }, { student_id: 'a', date: '2026-12-12', status: 'absent' as const }]
    const rows = buildRows(roster, [stu('a', '301', 2), stu('b', '201', 5)], marks, '2026-12-05')
    expect(rows.map(r => r.student.student_id)).toEqual(['z', 'b', 'a'])
    expect(rows.find(r => r.student.student_id === 'a')!.status).toBe('present')
    expect(rows.find(r => r.student.student_id === 'b')!.onLeave).toBe(true)
    expect(buildRows(roster, [], marks, '2026-12-05', 'A').map(r => r.student.student_id)).toEqual(['a'])
    expect(summarize(rows)).toEqual({ total: 3, present: 1, absent: 0, pending: 2 })
  })
  it('套用點名：覆蓋、清除', () => {
    let m = applyMark([], 's', '2026-12-05', 'present')
    m = applyMark(m, 's', '2026-12-05', 'absent'); expect(m).toEqual([{ student_id: 's', date: '2026-12-05', status: 'absent' }])
    expect(applyMark(m, 's', '2026-12-05', null)).toEqual([])
  })
})
describe('路由與手足工作階段', () => {
  it('解析教師點名路徑', () => {
    expect(parseRoute('/teacher-rollcall/abc-123')).toEqual({ name: 'teacher', campId: 'abc-123' })
    expect(parseRoute('/teacher-rollcall/abc/')).toEqual({ name: 'teacher', campId: 'abc' })
    expect(parseRoute('/')).toBeNull(); expect(parseRoute('/teacher-rollcall')).toBeNull()
    expect(teacherLink('a b', 'https://x.tw')).toBe('https://x.tw/teacher-rollcall/a%20b')
  })
  it('新增／移除／改密碼／切換', () => {
    let l = addSession([], { id: 'a', password: '1' })
    l = addSession(l, { id: 'b', password: '2' }); expect(addSession(l, { id: 'b', password: 'x' })).toBe(l)
    expect(updatePassword(l, 'b', 'new').find(s => s.id === 'b')!.password).toBe('new')
    const rest = removeSession(l, 'a')
    expect(nextActiveId(rest, 'a', 'a')).toBe('b'); expect(nextActiveId(rest, 'b', 'a')).toBe('b')
    expect(nextActiveId([], 'b', 'b')).toBeNull()
  })
})
