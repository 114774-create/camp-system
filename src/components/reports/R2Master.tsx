import { useMemo, useState } from 'react'
import { ReportProps, byClassNo, contactOf, enrolledJoin, isLeaveDay } from '../../lib/report'
import { md } from '../../lib/validate'
import { useI18n } from '../../lib/I18nContext'
import { displayStudentName } from '../../lib/maskName'

export default function R2Master(p: ReportProps) {
  const { locale, t } = useI18n()
  const [mode, setMode] = useState<'date' | 'matrix'>('matrix')
  const dates = useMemo(() => [...new Set(p.camps.flatMap(c => c.dates))].sort(), [p.camps])
  const [d, setD] = useState(dates[0])
  const all = p.camps.flatMap(c => enrolledJoin(c.id, p).map(x => ({ ...x, c })))
  const stus = [...new Map(all.map(x => [x.s.student_id, x.s])).values()].sort(byClassNo)
  const leaveMark = t('leave.mark')

  return (
    <div>
      <div className="no-print flex gap-2 mb-3 flex-wrap">
        <button onClick={() => setMode('date')} className="px-2 bg-gray-200 rounded">{locale === 'en' ? 'By date' : '依日期'}</button>
        <button onClick={() => setMode('matrix')} className="px-2 bg-gray-200 rounded">{locale === 'en' ? 'Full matrix' : '全檔期矩陣'}</button>
        {mode === 'date' && (
          <select value={d} onChange={e => setD(e.target.value)}>
            {dates.map(x => <option key={x} value={x}>{md(x)}</option>)}
          </select>
        )}
      </div>

      {mode === 'date' ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {(locale === 'en'
                ? ['Class', 'Seat', 'Name', 'Emergency contact', 'Camp/Class', 'Sign-in', 'Notes']
                : ['班級', '座號', '姓名', '緊急聯絡人與電話', '營隊/分班', '簽到', '接送/備註']
              ).map(h => <th key={h} className="border p-1">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {all.filter(x => x.c.dates.includes(d)).sort((a, b) => byClassNo(a.s, b.s)).map(x => (
              <tr key={x.r.id}>
                <td className="border p-1">{x.s.classCode}</td>
                <td className="border p-1">{x.s.no}</td>
                <td className="border p-1">{displayStudentName(x.s, { locale, revealed: true })}</td>
                <td className="border p-1 text-xs">{contactOf(x.s.student_id, p.profiles)}</td>
                <td className="border p-1">
                  {x.c.name}{x.r.assigned_sub_class ?? ''}
                  {isLeaveDay(x.r, d) ? `（${leaveMark}）` : ''}
                </td>
                <td className="border w-16 text-center text-xs text-rose-600">{isLeaveDay(x.r, d) ? leaveMark : ''}</td>
                <td className="border w-24" />
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border p-1">{locale === 'en' ? 'Class-Seat Name / Contact' : '班級-座號 姓名／聯絡人'}</th>
              {dates.map(x => <th key={x} className="border p-1">{md(x)}</th>)}
            </tr>
          </thead>
          <tbody>
            {stus.map(s => (
              <tr key={s.student_id}>
                <td className="border p-1">
                  {s.classCode}-{s.no} {displayStudentName(s, { locale, revealed: true })}
                  <div className="text-[10px] text-slate-500">{contactOf(s.student_id, p.profiles)}</div>
                </td>
                {dates.map(x => {
                  const h = all.find(a => a.s.student_id === s.student_id && a.c.dates.includes(x))
                  if (!h) return <td key={x} className="border p-1" />
                  return (
                    <td key={x} className="border p-1 text-center">
                      {h.c.name.slice(0, 3)} {isLeaveDay(h.r, x) ? leaveMark : '☐'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
