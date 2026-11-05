import { Student } from '../types'

const API_URL = (import.meta.env.VITE_STUDENT_SHEET_API_URL as string | undefined)?.trim()
const SHEET_URL = (import.meta.env.VITE_GOOGLE_SHEET_URL as string | undefined)?.trim()

const norm = (r: Record<string, unknown>): Student | null => {
  const id = String(r.id ?? r.student_id ?? '').trim()
  if (!id) return null
  const g = Number(r.grade)
  if (!Number.isFinite(g) || g < 100) return null
  const masked = r.maskedName ?? r.masked_name
  const ename = r.ename ?? r.englishName ?? r.english_name
  return {
    student_id: id,
    grade: Math.floor(g / 100),
    classCode: String(g),
    no: Number(r.no),
    name: String(r.name ?? '').trim(),
    maskedName: masked ? String(masked).trim() : undefined,
    ename: ename ? String(ename).trim() : undefined,
  }
}

export const sort = (l: Student[]) => [...l].sort((a, b) => +a.classCode - +b.classCode || a.no - b.no)

/** 從各種 Google 試算表網址抽出 spreadsheet id */
export function extractSheetId(urlOrId: string): string | null {
  const s = urlOrId.trim()
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s) && !s.includes('/')) return s
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m?.[1] ?? null
}

/** 轉成 gviz CSV：sheet=Students */
export function toGvizCsvUrl(urlOrId: string, sheetName = 'Students'): string | null {
  const id = extractSheetId(urlOrId)
  if (!id) return null
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; continue }
      if (ch === '"') { inQuotes = false; continue }
      cell += ch
      continue
    }
    if (ch === '"') { inQuotes = true; continue }
    if (ch === ',') { row.push(cell); cell = ''; continue }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++
      row.push(cell)
      if (row.some(c => c.trim() !== '')) rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += ch
  }
  if (cell.length || row.length) {
    row.push(cell)
    if (row.some(c => c.trim() !== '')) rows.push(row)
  }
  if (rows.length < 2) return []
  const headers = rows[0].map(h => h.trim())
  return rows.slice(1).map(cols => {
    const o: Record<string, string> = {}
    headers.forEach((h, i) => { o[h] = (cols[i] ?? '').trim() })
    return o
  })
}

async function fetchFromApiUrl(url: string): Promise<Student[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`sheet_api_http_${res.status}`)
  const ct = res.headers.get('content-type') ?? ''
  const text = await res.text()
  let raw: unknown
  if (ct.includes('json') || text.trim().startsWith('[') || text.trim().startsWith('{')) {
    raw = JSON.parse(text)
  } else {
    raw = parseCsv(text)
  }
  const arr = Array.isArray(raw) ? raw : (raw as any)?.data ?? (raw as any)?.students ?? []
  if (!Array.isArray(arr)) throw new Error('sheet_api_not_array')
  const list = arr.map((r: any) => norm(r)).filter(Boolean) as Student[]
  if (!list.length) throw new Error('empty')
  return sort(list)
}

async function fetchFromGoogleSheet(urlOrId: string): Promise<Student[]> {
  const csvUrl = toGvizCsvUrl(urlOrId)
  if (!csvUrl) throw new Error('invalid_sheet_url')
  const res = await fetch(csvUrl)
  if (!res.ok) throw new Error(`gviz_http_${res.status}`)
  const list = parseCsv(await res.text()).map(norm).filter(Boolean) as Student[]
  if (!list.length) throw new Error('empty')
  return sort(list)
}

export async function loadStudents(): Promise<Student[]> {
  try {
    if (API_URL) return await fetchFromApiUrl(API_URL)
    if (SHEET_URL) return await fetchFromGoogleSheet(SHEET_URL)
    return mock()
  } catch (e) {
    console.warn('[studentService] 無法載入 Google 學生名單，改用 Mock：', e)
    return mock()
  }
}

export function mock(): Student[] {
  const pairs = [
    { name: '王小明', ename: 'Ming' },
    { name: '李小華', ename: 'Hua' },
    { name: '陳小美', ename: 'Mei' },
    { name: '林大同', ename: 'Tong' },
    { name: '張育誠', ename: 'Kevin' },
    { name: '黃雅婷', ename: 'Tina' },
  ]
  const out: Student[] = []
  for (let g = 1; g <= 6; g++) {
    pairs.forEach((p, i) => out.push({
      student_id: `${g}01${String(i + 1).padStart(2, '0')}`,
      grade: g,
      classCode: `${g}01`,
      no: i + 1,
      name: `${p.name}${g}`,
      ename: p.ename,
    }))
  }
  return out
}
