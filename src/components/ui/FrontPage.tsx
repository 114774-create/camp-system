import { useState } from 'react'
import {
  AlertCircle, CalendarDays, CheckCircle2, Clock, IdCard, KeyRound,
  LogOut, MapPin, Sparkles, Ticket, UserRound, XCircle,
} from 'lucide-react'
import { Camp, Registration, Student, StudentProfile, SystemSettings } from '../../types'
import { buttonState, canCancelOrEnroll, canRequestLeave, md, validateRegistration, VResult } from '../../lib/validate'
import { campLabel, clsName } from '../../lib/report'
import { displayStudentName } from '../../lib/maskName'
import { useI18n } from '../../lib/I18nContext'

export interface FrontPageProps {
  students: Student[]
  camps: Camp[]
  regs: Registration[]
  profiles: StudentProfile[]
  settings: SystemSettings | null
  loggedInStudentId: string | null
  getProfile: (id: string) => StudentProfile
  onLogin: (studentId: string, password: string) => Promise<{ ok: true } | { ok: false; message: string; locked: boolean }>
  onLogout: () => void
  onChangePassword: (studentId: string, next: string) => Promise<void>
  onEnroll: (s: Student, c: Camp) => Promise<VResult>
  onCancel: (regId: string) => Promise<VResult>
  onLeave: (regId: string, dates: string[], reason: string) => Promise<VResult>
}

function capacityTone(n: number, max: number) {
  if (n >= max) return { bar: 'bg-rose-500', text: 'text-rose-600', key: 'camp.full' as const }
  if (max > 0 && (max - n) / max < 0.2) return { bar: 'bg-amber-500', text: 'text-amber-700', key: 'camp.low' as const }
  return { bar: 'bg-emerald-500', text: 'text-emerald-700', key: 'camp.plenty' as const }
}

export default function FrontPage(p: FrontPageProps) {
  const { t, locale } = useI18n()
  const [cc, setCc] = useState('101')
  const [sid, setSid] = useState(p.loggedInStudentId ?? '')
  const [pwd, setPwd] = useState('')
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(false)
  const [newPwd, setNewPwd] = useState('')
  const [leaveFor, setLeaveFor] = useState<string | null>(null)
  const [leaveDates, setLeaveDates] = useState<string[]>([])
  const [leaveReason, setLeaveReason] = useState('')

  const stu = p.students.find(s => s.student_id === (p.loggedInStudentId || sid))
  const revealed = !!p.loggedInStudentId && p.loggedInStudentId === stu?.student_id
  const mine = p.regs.filter(r => r.student_id === p.loggedInStudentId && r.status === 'enrolled')
  const classStudents = p.students.filter(s => s.classCode === cc)
  const windowOpen = canCancelOrEnroll(p.settings)
  const profile = p.loggedInStudentId ? p.getProfile(p.loggedInStudentId) : null

  const showMsg = (text: string, ok = false) => { setMsg(text); setMsgOk(ok) }

  const gradeLabel = (g: number) => t('grade.n', { n: g })

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-orange-50 via-white to-amber-50 shadow-soft" aria-label={t('pass.title')}>
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-200/40 blur-2xl" />
        <div className="relative grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:items-center sm:p-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-md sm:h-20 sm:w-20">
            <IdCard className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="font-display text-sm font-bold uppercase tracking-wider text-orange-600">{t('pass.title')}</p>
              {stu && revealed && <span className="badge-pill bg-orange-500 text-white">{gradeLabel(stu.grade)}</span>}
            </div>

            {!revealed ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="grid gap-1 text-xs font-medium text-slate-500">
                  {t('pass.class')}
                  <select className="input-field" value={cc} aria-label={t('pass.class')} onChange={e => { setCc(e.target.value); setSid('') }}>
                    {[101, 201, 301, 401, 501, 601].map(c => (
                      <option key={c} value={c}>{c} {clsName(String(c))}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-500">
                  {t('pass.student')}
                  <select className="input-field" value={sid} aria-label={t('pass.student')} onChange={e => setSid(e.target.value)}>
                    <option value="">{t('pass.pickStudent')}</option>
                    {classStudents.map(s => (
                      <option key={s.student_id} value={s.student_id}>
                        {s.no} {displayStudentName(s, { locale, revealed: false })}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-500">
                  {t('pass.password')}
                  <div className="flex gap-2">
                    <input type="password" className="input-field" value={pwd} onChange={e => setPwd(e.target.value)} aria-label={t('pass.password')} placeholder="10101" />
                    <button
                      type="button"
                      className="btn-primary shrink-0"
                      disabled={!sid || !pwd}
                      onClick={async () => {
                        const r = await p.onLogin(sid, pwd)
                        if (!r.ok) showMsg(r.message, false)
                        else { setPwd(''); showMsg(locale === 'en' ? 'Signed in' : '登入成功', true) }
                      }}
                    >
                      {t('pass.login')}
                    </button>
                  </div>
                </label>
              </div>
            ) : stu && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-amber-100 bg-white/70 px-3 py-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                    <UserRound className="h-4 w-4 text-orange-500" aria-hidden />
                    {stu.classCode}-{stu.no} {displayStudentName(stu, { locale, revealed: true })}
                  </span>
                  <span className="badge-pill bg-emerald-100 text-emerald-700">
                    <Ticket className="h-3 w-3" aria-hidden />
                    {t('pass.enrolledCount', { n: mine.length })}
                  </span>
                  <button type="button" className="btn-ghost !py-1.5 !text-xs ml-auto" onClick={p.onLogout}>
                    <LogOut className="h-3.5 w-3.5" aria-hidden />
                    {t('pass.logout')}
                  </button>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="grid flex-1 gap-1 text-xs text-slate-500 min-w-[12rem]">
                    {t('pass.changePwd')}
                    <input type="password" className="input-field" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                  </label>
                  <button
                    type="button"
                    className="btn-ghost !py-2"
                    disabled={newPwd.length < 4}
                    onClick={async () => {
                      await p.onChangePassword(stu.student_id, newPwd)
                      setNewPwd('')
                      showMsg(locale === 'en' ? 'Password updated' : '密碼已更新', true)
                    }}
                  >
                    <KeyRound className="h-4 w-4" aria-hidden />
                    {t('pass.changePwd')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {msg && (
        <div
          role="alert"
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 shadow-sm ${msgOk ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}
          onClick={() => setMsg('')}
          tabIndex={0}
        >
          {msgOk ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />}
          <div className="flex-1">
            <p className="font-semibold">{msgOk ? t('msg.ok') : t('msg.note')}</p>
            <p className="text-sm">{msg}</p>
          </div>
          <span className="text-xs text-slate-400">{t('btn.close')}</span>
        </div>
      )}

      {!revealed && (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-white/60 px-4 py-10 text-center text-slate-500">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-amber-400" />
          <p className="font-medium">{t('pass.needLogin')}</p>
        </div>
      )}

      {revealed && stu && (
        <>
          {mine.length > 0 && (
            <section>
              <h2 className="section-title mb-3 flex items-center gap-2">
                <Ticket className="h-5 w-5 text-orange-500" />
                {t('camp.mine')}
              </h2>
              <ol className="relative space-y-3 border-l-2 border-orange-200 pl-5">
                {mine.map(r => {
                  const c = p.camps.find(x => x.id === r.camp_id)
                  if (!c) return null
                  const sub = c.sub_classes.find(sc => sc.id === r.assigned_sub_class)
                  const leaveOk = canRequestLeave(c)
                  return (
                    <li key={r.id} className="relative">
                      <span className="absolute -left-[1.4rem] top-4 h-3 w-3 rounded-full border-2 border-white bg-orange-500 shadow" />
                      <div className="camp-card flex flex-col gap-3 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold text-slate-800">{campLabel(c, locale)}</p>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{c.dates.map(md).join('、')}</span>
                              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.start_time}-{c.end_time}</span>
                              {c.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.location}</span>}
                              {sub && <span className="badge-pill bg-sky-100 text-sky-700">{t('camp.subClass', { n: sub.name })}</span>}
                              {(r.leave_dates?.length ?? 0) > 0 && (
                                <span className="badge-pill bg-rose-100 text-rose-700">{t('leave.mark')}: {r.leave_dates!.map(md).join(', ')}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 disabled:opacity-40"
                              disabled={!windowOpen}
                              onClick={async () => {
                                const v = await p.onCancel(r.id)
                                showMsg(v.ok ? t('camp.cancelled') : v.message, v.ok)
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                              {t('camp.cancel')}
                            </button>
                            <button
                              type="button"
                              className="btn-ghost !py-2 disabled:opacity-40"
                              disabled={!leaveOk}
                              title={!leaveOk ? t('camp.leaveBlocked') : undefined}
                              onClick={() => {
                                if (!leaveOk) { showMsg(t('camp.leaveBlocked')); return }
                                setLeaveFor(r.id)
                                setLeaveDates(r.leave_dates ?? [])
                                setLeaveReason(r.leave_reason ?? '')
                              }}
                            >
                              {t('camp.leave')}
                            </button>
                          </div>
                        </div>
                        {!leaveOk && (
                          <div className="alert-pill border-amber-200 bg-amber-50 text-amber-900">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{t('camp.leaveBlocked')}</span>
                          </div>
                        )}
                        {leaveFor === r.id && leaveOk && (
                          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 grid gap-2">
                            <p className="text-sm font-semibold text-sky-800">{t('camp.leaveDates')}</p>
                            <div className="flex flex-wrap gap-2">
                              {c.dates.map(d => (
                                <label key={d} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={leaveDates.includes(d)}
                                    onChange={e => setLeaveDates(prev => e.target.checked ? [...prev, d] : prev.filter(x => x !== d))}
                                  />
                                  {md(d)}
                                </label>
                              ))}
                            </div>
                            <label className="grid gap-1 text-sm">
                              {t('camp.leaveReason')}
                              <input className="input-field" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} />
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={async () => {
                                  const v = await p.onLeave(r.id, leaveDates, leaveReason)
                                  showMsg(v.ok ? t('camp.leaveSaved') : v.message, v.ok)
                                  if (v.ok) setLeaveFor(null)
                                }}
                              >
                                {t('camp.leaveSubmit')}
                              </button>
                              <button type="button" className="btn-ghost" onClick={() => setLeaveFor(null)}>{t('btn.cancel')}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          )}

          <section>
            <h2 className="section-title mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              {t('camp.list')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {p.camps.map(c => {
                const v = validateRegistration(stu, c, c.dates[0], p.regs, p.camps, { profile: profile ?? undefined, settings: p.settings })
                const b = buttonState(v)
                const n = p.regs.filter(r => r.camp_id === c.id && r.status === 'enrolled').length
                const tone = capacityTone(n, c.max_capacity)
                const pct = Math.min(100, Math.round((n / Math.max(1, c.max_capacity)) * 100))
                const isSingle = c.attendance_mode === 'single_day_choice'
                const gradeBadge = c.allowed_grades.length >= 6
                  ? t('camp.gradeAll')
                  : t('camp.gradeRange', { a: c.allowed_grades[0], b: c.allowed_grades[c.allowed_grades.length - 1] })

                return (
                  <article key={c.id} className="camp-card flex flex-col p-4">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <span className={`badge-pill ${isSingle ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {isSingle ? t('camp.singleDay') : t('camp.fullCourse')}
                      </span>
                      <span className="badge-pill bg-sky-100 text-sky-800">{gradeBadge}</span>
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-800">{campLabel(c, locale)}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {c.dates.map(md).join('、')} · {c.start_time}-{c.end_time}{c.location ? ` · ${c.location}` : ''}
                    </p>
                    {c.teacher && <p className="mt-0.5 text-xs text-slate-400">{t('camp.teacher', { t: c.teacher })}</p>}
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className={`font-semibold ${tone.text}`}>{n} / {c.max_capacity}　{t(tone.key)}</span>
                        <span className="text-slate-400">{pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="mt-auto pt-3">
                      <button
                        type="button"
                        disabled={b.disabled || !windowOpen}
                        className="btn-primary w-full"
                        onClick={async () => {
                          const result = await p.onEnroll(stu, c)
                          showMsg(result.ok ? t('camp.success') : result.message, result.ok)
                        }}
                      >
                        {locale === 'en'
                          ? (b.label === '報名' ? t('camp.enroll')
                            : b.label === '年級不符' ? t('camp.gradeMismatch')
                              : b.label === '已額滿' ? t('camp.fullBtn')
                                : b.label === '已報名' ? t('camp.already')
                                  : b.label)
                          : b.label}
                      </button>
                      {!v.ok && (
                        <div className="alert-pill border-amber-200 bg-amber-50 text-amber-900">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{v.code === 'CONTACT' ? t('camp.needContact') : v.message}</span>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
