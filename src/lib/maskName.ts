/** 中文姓名遮罩：王小明→王〇明、王明→王〇、歐陽小明→歐〇〇明 */
export function maskName(name: string): string {
  const n = (name ?? '').trim()
  if (!n) return ''
  if (n.length === 1) return '〇'
  if (n.length === 2) return n[0] + '〇'
  return n[0] + '〇'.repeat(n.length - 2) + n[n.length - 1]
}

/** 依語系與登入狀態顯示學生姓名 */
export function displayStudentName(
  student: { name: string; ename?: string },
  opts: { locale: 'zh-TW' | 'en'; revealed: boolean },
): string {
  const zh = opts.revealed ? student.name : maskName(student.name)
  if (opts.locale === 'en') {
    const en = student.ename?.trim()
    if (en) return `${en} (${zh})`
    return zh
  }
  return zh
}
