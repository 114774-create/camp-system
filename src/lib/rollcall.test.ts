import { describe, expect, it } from 'vitest'
import { applyMark, buildRows, pickDefaultDate, summarize, todayTaipei } from './rollcall'
import { parseRoute, teacherLink } from './route'
import { addSession, nextActiveName, removeSession, updatePassword } from './siblings'
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
      { student_name: 'Nb', assigned_sub_class: 'B', leave_dates: ['2026-12-05'] },
      { student_name: 'Na', assigned_sub_class: 'A', leave_dates: [] },
      { student_name: 'Nz', snapshot_student_id: '10105', leave_dates: [] },   // 不在學生名單
    ]
    const marks = [{ student_name: 'Na', date: '2026-12-05', status: 'present' as const }, { student_name: 'Na', date: '2026-12-12', status: 'absent' as const }]
    const rows = buildRows(roster, [stu('a', '301', 2), stu('b', '201', 5)], marks, '2026-12-05')
    // z 不在名單 → 以報名當下的學號快照（10105 → 101 班 5 號）排最前；其餘以姓名對應到最新班級座號
    expect(rows.map(r => r.student.name)).toEqual(['Nz', 'Nb', 'Na'])
    expect(rows[0].student).toMatchObject({ classCode: '101', no: 5, student_id: '10105' })
    expect(rows.find(r => r.student.name === 'Na')!.status).toBe('present')
    expect(rows.find(r => r.student.name === 'Nb')!.onLeave).toBe(true)
    expect(buildRows(roster, [], marks, '2026-12-05', 'A').map(r => r.student.name)).toEqual(['Na'])
    expect(summarize(rows)).toEqual({ total: 3, present: 1, absent: 0, pending: 2 })
  })
  it('套用點名：覆蓋、清除', () => {
    let m = applyMark([], 's', '2026-12-05', 'present')
    m = applyMark(m, 's', '2026-12-05', 'absent'); expect(m).toEqual([{ student_name: 's', date: '2026-12-05', status: 'absent' }])
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
  it('以姓名為鍵：新增／移除／改密碼／切換', () => {
    let l = addSession([], { name: '王小明', studentId: '10101', password: '1' })
    l = addSession(l, { name: '李小華', studentId: '30102', password: '2' })
    expect(addSession(l, { name: '李小華', studentId: '99999', password: 'x' })).toBe(l)   // 同姓名視為同一人（學號不同也一樣）
    expect(updatePassword(l, '李小華', 'new').find(s => s.name === '李小華')!.password).toBe('new')
    const rest = removeSession(l, '王小明')
    expect(nextActiveName(rest, '王小明', '王小明')).toBe('李小華'); expect(nextActiveName(rest, '李小華', '王小明')).toBe('李小華')
    expect(nextActiveName([], '李小華', '李小華')).toBeNull()
  })
})

import { rosterFromRegs as _rfr } from './rollcall'
describe('rosterFromRegs（後台點名結果）', () => {
  it('只帶正取、保留請假與分班', () => {
    const regs: any[] = [
      { id: '1', student_name: 'A', camp_id: 'c', status: 'enrolled', snapshot_student_id: '30101', leave_dates: ['2026-12-05'], created_at: '' },
      { id: '2', student_name: 'B', camp_id: 'c', status: 'waitlisted', created_at: '' },
      { id: '3', student_name: 'C', camp_id: 'd', status: 'enrolled', created_at: '' },
    ]
    const r = _rfr(regs, 'c')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ student_name: 'A', leave_dates: ['2026-12-05'] })
  })
})
