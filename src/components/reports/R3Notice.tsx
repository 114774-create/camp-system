import { useState } from 'react'
import { Student } from '../../types'
import { ReportProps, byClassNo, campLabel, contactOf, enrolledJoin } from '../../lib/report'
import { md } from '../../lib/validate'
import { normName } from '../../lib/name'
import { useI18n } from '../../lib/I18nContext'
import { displayStudentName } from '../../lib/maskName'

export default function R3Notice(p: ReportProps) {
  const { locale } = useI18n()
  const [by, setBy] = useState<'class' | 'camp'>('class')
  const [key, setKey] = useState('101')
  const all = p.camps.flatMap(c => enrolledJoin(c.id, p).map(x => ({ ...x, c })))
  const pick = by === 'class' ? all.filter(x => x.s.classCode === key) : all.filter(x => x.c.id === key)
  const stus = [...new Map(pick.map(x => [normName(x.s.name), x.s])).values()].sort(byClassNo)
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
          {pg.map(s => {
            const mine = all.filter(x => normName(x.s.name) === normName(s.name))
            const sname = displayStudentName(s, { locale, revealed: true })
            const en = locale === 'en'
            return (
              <div key={normName(s.name)} className="mb-2 flex flex-col border-b border-slate-300 pb-2" style={{ height: '88mm' }}>
                {/* 上半：營隊資訊（家長留存） */}
                <div>
                  <h3 className="text-center font-bold">
                    {p.camps[0]?.term} {en ? 'Camp Enrollment Notice' : '營隊錄取暨上課通知單'}
                  </h3>
                  <p className="text-sm">
                    {s.classCode} {en ? 'Class' : '班'} {s.no} {en ? 'No.' : '號'}　{sname}
                  </p>
                  <p className="text-xs text-slate-600">
                    {en ? 'Emergency contact' : '緊急聯絡人'}：{contactOf(s, p.profiles)}
                  </p>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        {(en ? ['Camp', 'Class', 'Dates', 'Time', 'Location', 'Notes'] : ['營隊', '分班', '日期', '時間', '地點', '注意事項'])
                          .map(h => <th key={h} className="border p-1">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {mine.map(x => (
                        <tr key={x.r.id}>
                          <td className="border p-1">{x.c.name}</td>
                          <td className="border p-1">{x.c.sub_classes.find(z => z.id === x.r.assigned_sub_class)?.name ?? '-'}</td>
                          <td className="border p-1">
                            {x.c.dates.map(d => {
                              const leave = (x.r.leave_dates ?? []).includes(d)
                              return `${md(d)}${leave ? `(${en ? 'Leave' : '請假'})` : ''}`
                            }).join('、')}
                          </td>
                          <td className="border p-1">{x.c.start_time}-{x.c.end_time}</td>
                          <td className="border p-1">{x.c.location}</td>
                          <td className="border p-1">{x.c.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-1 text-[10px] text-slate-500">{en ? 'Please keep the section above for your records.' : '以上資料請家長留存。'}</p>
                </div>

                {/* 裁切線 + 下半：家長簽收回條（剪下後交回） */}
                <div className="mt-auto">
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-600">
                    <span aria-hidden>✂</span>
                    <span className="flex-1 border-t-2 border-dashed border-slate-500" />
                    <span>{en ? 'Cut along the dashed line · return the slip below' : '沿虛線剪下・交回簽收回條'}</span>
                    <span className="flex-1 border-t-2 border-dashed border-slate-500" />
                  </div>
                  <p className="text-xs">
                    <b>{en ? 'Parent acknowledgment' : '家長簽收回條'}</b>：{s.classCode} {en ? 'Class' : '班'} {s.no} {en ? 'No.' : '號'} {sname}
                  </p>
                  <p className="text-xs text-slate-700">{en ? 'Camps' : '報名營隊'}：{mine.map(x => campLabel(x.c, locale)).join('、')}</p>
                  <p className="mt-1 text-xs">
                    {en ? 'I have read the camp information above. Signature: __________ Date: ______' : '我已知悉上述營隊資訊。家長簽名：__________　日期：______'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
