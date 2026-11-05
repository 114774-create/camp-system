import { useState } from 'react'
import { ReportProps, campLabel, csv, enrolledJoin } from '../../lib/report'
import { md } from '../../lib/validate'
export default function R1Attendance(p: ReportProps) {
  const [cid, setCid] = useState(p.camps[0]?.id ?? ''); const [sub, setSub] = useState('')
  const c = p.camps.find(x => x.id === cid); if (!c) return <p>尚無營隊</p>
  const rows = enrolledJoin(cid, p).filter(x => !sub || x.r.assigned_sub_class === sub)
  const heads = ['序號', '班級', '座號', '學號', '姓名', ...c.dates.map(md), '備註']
  return <div>
    <div className="no-print flex gap-2 mb-3">
      <select className="border p-1" value={cid} onChange={e => { setCid(e.target.value); setSub('') }}>{p.camps.map(x => <option key={x.id} value={x.id}>{campLabel(x)}</option>)}</select>
      {c.has_sub_classes && <select className="border p-1" value={sub} onChange={e => setSub(e.target.value)}><option value="">全部班別</option>{c.sub_classes.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
      <button onClick={() => csv('簽到表', [heads, ...rows.map((x, i) => [i + 1, x.s.classCode, x.s.no, x.s.student_id, x.s.name, ...c.dates.map(() => ''), ''])])} className="px-2 bg-gray-200">匯出CSV</button></div>
    <h2 className="text-center text-xl font-bold">{c.term}　{campLabel(c)}{sub && `（${c.sub_classes.find(s => s.id === sub)?.name}）`} 簽到表</h2>
    <p className="text-sm">地點：{c.location}　講師：{c.teacher}　日期：{c.dates.map(md).join('、')} {c.start_time}-{c.end_time}</p>
    <table className="w-full border-collapse text-sm"><thead><tr>{heads.map(h => <th key={h} className="border p-1">{h}</th>)}</tr></thead>
      <tbody>{rows.map((x, i) => <tr key={x.r.id}>{[i + 1, x.s.classCode, x.s.no, x.s.student_id, x.s.name].map((v, j) => <td key={j} className="border p-1">{v}</td>)}{c.dates.map(d => <td key={d} className="border p-1 w-16" />)}<td className="border" /></tr>)}</tbody></table>
    <p className="mt-3 text-sm">應到：{rows.length}　實到：____　請假：____　教師簽名：________　行政核章：________</p>
  </div>
}
