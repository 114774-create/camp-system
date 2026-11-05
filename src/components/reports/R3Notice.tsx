import { useState } from 'react'
import { Student } from '../../types'
import { ReportProps, byClassNo, campLabel, contactOf, enrolledJoin } from '../../lib/report'
import { md } from '../../lib/validate'
import { useI18n } from '../../lib/I18nContext'
import { displayStudentName } from '../../lib/maskName'

export default function R3Notice(p: ReportProps) {
  const { locale } = useI18n()
  const [by, setBy] = useState<'class' | 'camp'>('class')
  const [key, setKey] = useState('101')
  const all = p.camps.flatMap(c => enrolledJoin(c.id, p).map(x => ({ ...x, c })))
  const pick = by === 'class' ? all.filter(x => x.s.classCode === key) : all.filter(x => x.c.id === key)
  const stus = [...new Map(pick.map(x => [x.s.student_id, x.s])).values()].sort(byClassNo)
  const pages: Student[][] = []
  for (let i = 0; i < stus.length; i += 3) pages.push(stus.slice(i, i + 3))

  return (
    <div>
      <div className="no-print flex gap-2 mb-3">
        <select value={by} onChange={e => { setBy(e.target.value as 'class' | 'camp'); setKey(e.target.value === 'class' ? '101' : p.camps[0]?.id ?? '') }}>
          <option value="class">{locale === 'en' ? 'By class' : '依原班級'}</option>
          <option value="camp">{locale === 'en' ? 'By camp' : '依營隊班別'}</option>
        </select>
        <select value={key} onChange={e => setKey(e.target.value)}>
          {by === 'class'
            ? [101, 201, 301, 401, 501, 601].map(c => <option key={c} value={c}>{c}</option>)
            : p.camps.map(c => <option key={c.id} value={c.id}>{campLabel(c, locale)}</option>)}
        </select>
      </div>
      {pages.map((pg, i) => (
        <div key={i} className="pg">
          {pg.map(s => (
            <div key={s.student_id} className="border-b-2 border-dashed pb-2 mb-2" style={{ height: '88mm' }}>
              <h3 className="text-center font-bold">
                {p.camps[0]?.term} {locale === 'en' ? 'Camp Enrollment Notice' : '營隊錄取暨上課通知單'}
              </h3>
              <p className="text-sm">
                {s.classCode} {locale === 'en' ? 'Class' : '班'} {s.no} {locale === 'en' ? 'No.' : '號'}　
                {displayStudentName(s, { locale, revealed: true })}
              </p>
              <p className="text-xs text-slate-600">
                {locale === 'en' ? 'Emergency contact' : '緊急聯絡人'}：{contactOf(s.student_id, p.profiles)}
              </p>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {(locale === 'en'
                      ? ['Camp', 'Class', 'Dates', 'Time', 'Location', 'Notes']
                      : ['營隊', '分班', '日期', '時間', '地點', '注意事項']
                    ).map(h => <th key={h} className="border p-1">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {all.filter(x => x.s.student_id === s.student_id).map(x => (
                    <tr key={x.r.id}>
                      <td className="border p-1">{x.c.name}</td>
                      <td className="border p-1">{x.c.sub_classes.find(z => z.id === x.r.assigned_sub_class)?.name ?? '-'}</td>
                      <td className="border p-1">
                        {x.c.dates.map(d => {
                          const leave = (x.r.leave_dates ?? []).includes(d)
                          return `${md(d)}${leave ? `(${locale === 'en' ? 'Leave' : '請假'})` : ''}`
                        }).join('、')}
                      </td>
                      <td className="border p-1">{x.c.start_time}-{x.c.end_time}</td>
                      <td className="border p-1">{x.c.location}</td>
                      <td className="border p-1">{x.c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs mt-2">
                {locale === 'en'
                  ? '✂ Parent acknowledgment: I have read the camp information. Signature: __________ Date: ______'
                  : '✂ 家長簽收回條：我已知悉上述營隊資訊。家長簽名：__________　日期：______'}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
