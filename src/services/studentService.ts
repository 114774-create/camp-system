import { Student } from '../types'
const SHEET_ID = '<GOOGLE_SHEET_URL_OR_ID>', GID = '69325146'
const norm = (r: any): Student | null => {
  const id = String(r.id ?? '').trim(); if (!id) return null
  const g = Number(r.grade)
  return { student_id: id, grade: Math.floor(g / 100), classCode: String(g), no: Number(r.no),
    name: String(r.name ?? '').trim(), ename: r.ename ? String(r.ename).trim() : undefined }
}
export const sort = (l: Student[]) => [...l].sort((a, b) => +a.classCode - +b.classCode || a.no - b.no)
export async function loadStudents(): Promise<Student[]> {
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`)
    const t = await res.text()
    const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1))
    const keys = ['id', 'grade', 'no', 'name', 'ename']
    const list = j.table.rows.map((row: any) => {
      const o: any = {}; keys.forEach((k, i) => (o[k] = row.c[i]?.f ?? row.c[i]?.v)); return norm(o)
    }).filter(Boolean) as Student[]
    if (!list.length) throw new Error('empty')
    return sort(list)
  } catch { return mock() }
}
export function mock(): Student[] {
  const names = ['王小明', '李小華', '陳小美', '林大同', '張育誠', '黃雅婷']
  const out: Student[] = []
  for (let g = 1; g <= 6; g++) names.forEach((n, i) => out.push({
    student_id: `${g}01${String(i + 1).padStart(2, '0')}`, grade: g, classCode: `${g}01`, no: i + 1, name: `${n}${g}` }))
  return out
}
