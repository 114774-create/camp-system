import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Download, PhoneCall } from 'lucide-react'
import { AttendanceRecord } from '../../types'
import { ReportProps, campLabel, contactOf, csv } from '../../lib/report'
import { buildRows, pickDefaultDate, rosterFromRegs, summarize, todayTaipei } from '../../lib/rollcall'
import { md } from '../../lib/validate'
import { useI18n } from '../../lib/I18nContext'
import { displayStudentName } from '../../lib/maskName'

/** 後台「點名結果」：看老師當天的點名，缺席學生旁直接顯示家長聯絡方式，方便通知 */
export default function AttendanceResults(p: ReportProps & { onLoad: () => Promise<AttendanceRecord[]> }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadedAt, setLoadedAt] = useState('')
  const today = todayTaipei()
  const [cid, setCid] = useState(() => (p.camps.find(c => c.dates.includes(today)) ?? p.camps[0])?.id ?? '')
  const camp = p.camps.find(c => c.id === cid)
  const [date, setDate] = useState(() => (camp ? pickDefaultDate(camp.dates, today) : today))

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setRecords(await p.onLoad()); setLoadedAt(new Date().toLocaleTimeString(en ? 'en-US' : 'zh-TW', { hour12: false })) }
    catch { setError(en ? 'Could not load roll call data. Did you run the 004 SQL in Supabase?' : '讀取點名資料失敗。請確認已在 Supabase 執行 004_admin_get_attendance.sql，或重新登入後台再試。') }
    finally { setLoading(false) }
  }, [p.onLoad, en])
  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => camp
    ? buildRows(rosterFromRegs(p.regs, camp.id), p.students, records.filter(r => r.camp_id === camp.id), date)
    : [], [camp, p.regs, p.students, records, date])
  const sum = summarize(rows)
  const absent = rows.filter(r => r.status === 'absent')
  const pending = rows.filter(r => !r.status)
  const label = (r: typeof rows[number]) => `${r.student.classCode}-${r.student.no} ${displayStudentName(r.student, { locale, revealed: true })}`

  if (!camp) return <p>{en ? 'No camps yet' : '尚無營隊'}</p>
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-xl font-bold">{en ? 'Roll call results' : '點名結果'}</h2>
        <select className="input-field !w-auto" value={cid} aria-label={en ? 'Camp' : '營隊'}
          onChange={e => { const c = p.camps.find(x => x.id === e.target.value); setCid(e.target.value); if (c) setDate(pickDefaultDate(c.dates, today)) }}>
          {p.camps.map(x => <option key={x.id} value={x.id}>{campLabel(x, locale)}</option>)}
        </select>
        <select className="input-field !w-auto" value={date} onChange={e => setDate(e.target.value)} aria-label={en ? 'Date' : '日期'}>
          {camp.dates.map(d => <option key={d} value={d}>{md(d)}{d === today ? (en ? ' (today)' : '（今天）') : ''}</option>)}
        </select>
        <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />{en ? 'Refresh' : '重新整理'}
        </button>
      </div>
      {loadedAt && <p className="-mt-2 text-xs text-slate-400">{en ? 'Updated' : '資料更新時間'} {loadedAt}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap gap-2 text-sm font-semibold">
        <span className="badge-pill bg-slate-100 text-slate-700">{en ? 'Enrolled' : '應到'} {sum.total}</span>
        <span className="badge-pill bg-emerald-100 text-emerald-700">{en ? 'Present' : '已簽到'} {sum.present}</span>
        <span className="badge-pill bg-rose-100 text-rose-700">{en ? 'Absent' : '缺席'} {sum.absent}</span>
        <span className="badge-pill bg-amber-100 text-amber-700">{en ? 'Not marked' : '尚未點名'} {sum.pending}</span>
      </div>

      <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-rose-500" aria-hidden />
          <h3 className="mr-auto font-bold">{en ? 'Absent — notify parents' : '缺席名單（需通知家長）'}</h3>
          <button type="button" className="btn-ghost inline-flex items-center gap-1.5 !py-1.5 text-sm" disabled={!absent.length}
            onClick={() => csv(`${en ? 'absent' : '缺席名單'}_${date}`, [
              [en ? 'Class' : '班級', en ? 'Seat' : '座號', en ? 'Name' : '姓名', en ? 'Parent contact' : '家長聯絡方式', en ? 'Note' : '備註'],
              ...absent.map(r => [r.student.classCode, r.student.no, displayStudentName(r.student, { locale, revealed: true }), contactOf(r.student, p.profiles), r.onLeave ? (en ? 'Leave requested' : '已事先請假') : '']),
            ])}>
            <Download className="h-4 w-4" aria-hidden />CSV
          </button>
        </div>
        {absent.length === 0 ? (
          <p className="text-sm text-slate-500">{sum.present + sum.absent === 0 ? (en ? 'The teacher has not marked anyone yet.' : '老師還沒有點名。') : (en ? 'No absences.' : '這天沒有缺席。')}</p>
        ) : (
          <ul className="grid gap-2">
            {absent.map(r => (
              <li key={r.entry.student_name} className="rounded-xl border border-rose-100 bg-rose-50/40 px-3 py-2 text-sm">
                <span className="font-semibold">{label(r)}</span>
                {r.onLeave && <span className="ml-2 badge-pill bg-sky-100 text-sky-700">{en ? 'Leave requested' : '已事先請假'}</span>}
                <div className="mt-0.5 text-slate-600">{contactOf(r.student, p.profiles) || (en ? 'No contact on file' : '尚未填寫緊急聯絡人')}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pending.length > 0 && (
        <details className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer font-bold">{en ? 'Not marked yet' : '尚未點名'}（{pending.length}）</summary>
          <p className="mt-2 text-sm text-slate-600">{pending.map(r => label(r) + (r.onLeave ? (en ? ' (leave)' : '（請假）') : '')).join('、')}</p>
        </details>
      )}
    </section>
  )
}
