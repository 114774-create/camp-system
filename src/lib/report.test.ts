import { describe, expect, it } from 'vitest'
import { Registration, Student } from '../types'
import { enrolledJoin, snapshotStudent } from './report'
import { buildRows } from './rollcall'

const stu = (id: string, name: string): Student => ({ student_id: id, grade: +id[0], classCode: id.slice(0, 3), no: +id.slice(3), name })
const reg = (name: string, snap: string | undefined, status: Registration['status'] = 'enrolled'): Registration =>
  ({ id: name + status, student_name: name, snapshot_student_id: snap, camp_id: 'c', status, created_at: '' })

describe('報名名單／簽到表：以姓名對應「最新」學號與班級', () => {
  it('去年報名時是 10101（一年級），升級後試算表是 20101 → 印出來帶入最新班級座號，快照學號不影響', () => {
    const rows = enrolledJoin('c', { students: [stu('20101', '王小明'), stu('30102', '李小華')], regs: [reg('王小明', '10101'), reg('李小華', '20102')] })
    expect(rows.map(r => [r.s.name, r.s.student_id, r.s.classCode])).toEqual([['王小明', '20101', '201'], ['李小華', '30102', '301']])
  })
  it('學號被新同學沿用：名單裡 20101 現在是另一個人，舊紀錄不會跑到新同學身上', () => {
    const students = [stu('20101', '陳新生'), stu('30101', '王小明')]
    const rows = enrolledJoin('c', { students, regs: [reg('王小明', '20101')] })   // 去年「王小明」的學號是 20101
    expect(rows).toHaveLength(1); expect(rows[0].s).toMatchObject({ name: '王小明', student_id: '30101' })
  })
  it('姓名比對忽略空白；只列正取', () => {
    const rows = enrolledJoin('c', { students: [stu('20101', '王 小明')], regs: [reg('王小明', '10101'), reg('王小明', '10101', 'waitlisted')] })
    expect(rows).toHaveLength(1)
  })
  it('名單已找不到此姓名（轉出／改名）：退回報名當下的快照，不會悄悄消失', () => {
    const rows = enrolledJoin('c', { students: [], regs: [reg('離校生', '10105')] })
    expect(rows[0].s).toMatchObject({ name: '離校生', classCode: '101', no: 5, student_id: '10105' })
    expect(snapshotStudent({ student_name: 'x', snapshot_student_id: undefined })).toMatchObject({ classCode: '000', no: 0 })
  })
  it('點名簿同樣以姓名對應最新班級座號', () => {
    const rows = buildRows([{ student_name: '王小明', snapshot_student_id: '10101', leave_dates: [] }], [stu('20101', '王小明')], [], '2026-12-05')
    expect(rows[0].student).toMatchObject({ student_id: '20101', classCode: '201' })
  })
})
