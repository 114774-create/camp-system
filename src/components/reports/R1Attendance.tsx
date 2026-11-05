import { useState } from 'react'
import { ReportProps, campLabel, contactOf, csv, enrolledJoin, isLeaveDay } from '../../lib/report'
import { md } from '../../lib/validate'
import { useI18n } from '../../lib/I18nContext'
import { displayStudentName } from '../../lib/maskName'

export default function R1Attendance(p: ReportProps) {
  const { locale, t } = useI18n()
  const [cid, setCid] = useState(p.camps[0]?.id ?? '')
  const [sub, setSub] = useState('')
  const c = p.camps.find(x => x.id === cid)
  if (!c) return <p>{locale === 'en' ? 'No camps yet' : '尚無營隊'}</p>
  const rows = enrolledJoin(cid, p).filter(x => !sub || x.r.assigned_sub_class === sub)
  const contactHeader = locale === 'en' ? 'Emergency contact' : '緊急聯絡人與電話'
  const leaveMark = t('leave.mark')
  const heads = [
    locale === 'en' ? 'No.' : '序號',
    locale === 'en' ? 'Class' : '班級',
    locale === 'en' ? 'Seat' : '座號',
    locale === 'en' ? 'ID' : '學號',
    locale === 'en' ? 'Name' : '姓名',
    contactHeader,
    ...c.dates.map(md),
    locale === 'en' ? 'Notes' : '備註',
  ]

  return (
    <div>
      <div className="no-print flex gap-2 mb-3 flex-wrap">
        <select className="border p-1 rounded" value={cid} onChange={e => { setCid(e.target.value); setSub('') }}>
          {p.camps.map(x => <option key={x.id} value={x.id}>{campLabel(x, locale)}</option>)}
        </select>
        {c.has_sub_classes && (
          <select className="border p-1 rounded" value={sub} onChange={e => setSub(e.target.value)}>
            <option value="">{locale === 'en' ? 'All classes' : '全部班別'}</option>
            {c.sub_classes.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        )}
        <button
          onClick={() => csv(locale === 'en' ? 'attendance' : '簽到表', [
            heads,
            ...rows.map((x, i) => [
              i + 1, x.s.classCode, x.s.no, x.s.student_id,
              displayStudentName(x.s, { locale, revealed: true }),
              contactOf(x.s.student_id, p.profiles),
              ...c.dates.map(d => isLeaveDay(x.r, d) ? leaveMark : ''),
              '',
            ]),
          ])}
          className="px-2 bg-gray-200 rounded"
        >
          CSV
        </button>
      </div>
      <h2 className="text-center text-xl font-bold">
        {c.term}　{campLabel(c, locale)}
        {sub && `（${c.sub_classes.find(s => s.id === sub)?.name}）`}
        {locale === 'en' ? ' Attendance' : ' 簽到表'}
      </h2>
      <p className="text-sm">
        {locale === 'en' ? 'Location' : '地點'}：{c.location}　
        {locale === 'en' ? 'Teacher' : '講師'}：{c.teacher}　
        {locale === 'en' ? 'Dates' : '日期'}：{c.dates.map(md).join('、')} {c.start_time}-{c.end_time}
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>{heads.map(h => <th key={h} className="border p-1">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((x, i) => (
            <tr key={x.r.id}>
              <td className="border p-1">{i + 1}</td>
              <td className="border p-1">{x.s.classCode}</td>
              <td className="border p-1">{x.s.no}</td>
              <td className="border p-1">{x.s.student_id}</td>
              <td className="border p-1">{displayStudentName(x.s, { locale, revealed: true })}</td>
              <td className="border p-1 text-xs">{contactOf(x.s.student_id, p.profiles)}</td>
              {c.dates.map(d => (
                <td key={d} className="border p-1 w-16 text-center text-xs text-rose-600">
                  {isLeaveDay(x.r, d) ? leaveMark : ''}
                </td>
              ))}
              <td className="border" />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-sm">
        {locale === 'en'
          ? `Expected: ${rows.length}　Present: ____　Leave: ____　Teacher: ________　Admin: ________`
          : `應到：${rows.length}　實到：____　請假：____　教師簽名：________　行政核章：________`}
      </p>
    </div>
  )
}
