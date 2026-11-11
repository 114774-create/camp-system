// 分頁 C：我的報名狀態（正取／候補時間軸、地點時間、取消、請假）
import { useState } from 'react'
import { AlertCircle, CalendarDays, Clock, Hourglass, MapPin, Ticket, XCircle } from 'lucide-react'
import { Camp, Registration, Student, PublicSettings } from '../../types'
import { canCancelOrEnroll, canRequestLeave, md, VResult } from '../../lib/validate'
import { campLabel } from '../../lib/report'
import { waitlistPosition } from '../../lib/waitlist'
import { useI18n } from '../../lib/I18nContext'
import Notice from './Notice'
export interface StatusPageProps {
  student: Student; camps: Camp[]; regs: Registration[]; settings: PublicSettings | null
  onCancel: (regId: string) => Promise<VResult>
  onLeave: (regId: string, dates: string[], reason: string) => Promise<VResult>
  onGoHome?: () => void
}
export default function StatusPage(p: StatusPageProps) {
  const { t, locale } = useI18n()
  const [msg, setMsg] = useState(''), [ok, setOk] = useState(false)
  const [leaveFor, setLeaveFor] = useState<string | null>(null)
  const [leaveDates, setLeaveDates] = useState<string[]>([]), [leaveReason, setLeaveReason] = useState('')
  const windowOpen = canCancelOrEnroll(p.settings)
  const show = (m: string, good = false) => { setMsg(m); setOk(good) }
  const rows = p.regs
    .filter(r => r.student_id === p.student.student_id && (r.status === 'enrolled' || r.status === 'waitlisted'))
    .map(r => ({ r, c: p.camps.find(x => x.id === r.camp_id) })).filter(x => x.c) as { r: Registration; c: Camp }[]
  rows.sort((a, b) => (a.c.dates[0] ?? '').localeCompare(b.c.dates[0] ?? ''))
  const nA = rows.filter(x => x.r.status === 'enrolled').length, nB = rows.length - nA

  return (
    <div className="grid max-w-3xl gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2"><Ticket className="h-5 w-5 text-orange-500" />{t('status.title')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('status.summary', { a: nA, b: nB })}</p>
      </div>
      <Notice msg={msg} ok={ok} onClose={() => setMsg('')} />
      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-white/60 px-4 py-10 text-center text-slate-500">
          <p className="font-medium">{t('status.empty')}</p>
          {p.onGoHome && <button type="button" className="btn-primary mt-3" onClick={p.onGoHome}>{t('status.goHome')}</button>}
        </div>
      )}
      <ol className="relative space-y-3 border-l-2 border-orange-200 pl-5">
        {rows.map(({ r, c }) => {
          const waiting = r.status === 'waitlisted'
          const sub = c.sub_classes.find(sc => sc.id === r.assigned_sub_class)
          const leaveOk = !waiting && canRequestLeave(c)
          return (
            <li key={r.id} className="relative">
              <span className={`absolute -left-[1.4rem] top-4 h-3 w-3 rounded-full border-2 border-white shadow ${waiting ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <div className="camp-card flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-800">{campLabel(c, locale)}</p>
                      {waiting
                        ? <span className="badge-pill bg-amber-100 text-amber-800"><Hourglass className="h-3 w-3" aria-hidden />{t('status.waitPos', { n: waitlistPosition(r, p.regs) })}</span>
                        : <span className="badge-pill bg-emerald-100 text-emerald-700">{t('status.enrolled')}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{c.dates.map(md).join('、')}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.start_time}-{c.end_time}</span>
                      {c.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.location}</span>}
                      {sub && !waiting && <span className="badge-pill bg-sky-100 text-sky-700">{t('camp.subClass', { n: sub.name })}</span>}
                      {(r.leave_dates?.length ?? 0) > 0 && <span className="badge-pill bg-rose-100 text-rose-700">{t('leave.mark')}: {r.leave_dates!.map(md).join(', ')}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!windowOpen}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 disabled:opacity-40"
                      onClick={async () => { const v = await p.onCancel(r.id); show(v.ok ? t('camp.cancelled') : v.message, v.ok) }}>
                      <XCircle className="h-4 w-4" />{waiting ? t('camp.cancelWait') : t('camp.cancel')}
                    </button>
                    {!waiting && (
                      <button type="button" className="btn-ghost !py-2 disabled:opacity-40" disabled={!leaveOk}
                        title={!leaveOk ? t('camp.leaveBlocked') : undefined}
                        onClick={() => { setLeaveFor(r.id); setLeaveDates(r.leave_dates ?? []); setLeaveReason(r.leave_reason ?? '') }}>
                        {t('camp.leave')}
                      </button>
                    )}
                  </div>
                </div>
                {!waiting && !leaveOk && (
                  <div className="alert-pill border-amber-200 bg-amber-50 text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{t('camp.leaveBlocked')}</span></div>
                )}
                {leaveFor === r.id && leaveOk && (
                  <div className="grid gap-2 rounded-xl border border-sky-100 bg-sky-50/50 p-3">
                    <p className="text-sm font-semibold text-sky-800">{t('camp.leaveDates')}</p>
                    <div className="flex flex-wrap gap-2">
                      {c.dates.map(d => (
                        <label key={d} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1 text-sm">
                          <input type="checkbox" checked={leaveDates.includes(d)} onChange={e => setLeaveDates(prev => e.target.checked ? [...prev, d] : prev.filter(x => x !== d))} />{md(d)}
                        </label>
                      ))}
                    </div>
                    <label className="grid gap-1 text-sm">{t('camp.leaveReason')}<input className="input-field" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} /></label>
                    <div className="flex gap-2">
                      <button type="button" className="btn-primary" onClick={async () => { const v = await p.onLeave(r.id, leaveDates, leaveReason); show(v.ok ? t('camp.leaveSaved') : v.message, v.ok); if (v.ok) setLeaveFor(null) }}>{t('camp.leaveSubmit')}</button>
                      <button type="button" className="btn-ghost" onClick={() => setLeaveFor(null)}>{t('btn.cancel')}</button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
