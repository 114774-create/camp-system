// 分頁 A：營隊報名與首頁（教學 + 登入 + 可報名營隊）。密碼修改已移至「個人資料與設定」，報名狀態已移至「我的報名狀態」。
import { useState } from 'react'
import { AlertCircle, IdCard, LogOut, Sparkles, Ticket, UserRound } from 'lucide-react'
import { Camp, Registration, Student, StudentProfileView, PublicSettings } from '../../types'
import { BtnKind, buttonState, canCancelOrEnroll, md, validateRegistration, VResult } from '../../lib/validate'
import { campLabel, clsName } from '../../lib/report'
import { displayStudentName } from '../../lib/maskName'
import { enrolledCount, waitlistOf } from '../../lib/waitlist'
import { useI18n } from '../../lib/I18nContext'
import GuideCard from './GuideCard'
import Notice from './Notice'

export interface FrontPageProps {
  students: Student[]
  camps: Camp[]
  regs: Registration[]
  profiles?: StudentProfileView[]
  settings: PublicSettings | null
  loggedInStudentId: string | null
  getProfile: (id: string) => StudentProfileView
  onLogin: (studentId: string, password: string) => Promise<{ ok: true } | { ok: false; message: string; locked: boolean }>
  onLogout: () => void
  onEnroll: (s: Student, c: Camp) => Promise<VResult>
  onNavigate?: (tab: 'status' | 'profile') => void
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

  const stu = p.students.find(s => s.student_id === (p.loggedInStudentId || sid))
  const revealed = !!p.loggedInStudentId && p.loggedInStudentId === stu?.student_id
  const myLive = p.regs.filter(r => r.student_id === p.loggedInStudentId)
  const nEnrolled = myLive.filter(r => r.status === 'enrolled').length
  const nWait = myLive.filter(r => r.status === 'waitlisted').length
  const windowOpen = canCancelOrEnroll(p.settings)
  const profile = p.loggedInStudentId ? p.getProfile(p.loggedInStudentId) : null
  const showMsg = (text: string, ok = false) => { setMsg(text); setMsgOk(ok) }

  const btnText = (kind: BtnKind, zh: string) => {
    if (locale !== 'en') return zh
    const m: Partial<Record<BtnKind, string>> = {
      enroll: t('camp.enroll'), waitlist: t('camp.waitlistBtn'), grade: t('camp.gradeMismatch'),
      full: t('camp.fullBtn'), already: t('camp.already'), waitlisted: t('camp.waitlisted'),
    }
    return m[kind] ?? zh
  }

  return (
    <div className="grid gap-5">
      <GuideCard />

      <section className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-orange-50 via-white to-amber-50 shadow-soft" aria-label={t('pass.title')}>
        <div className="relative grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:items-center sm:p-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-md sm:h-20 sm:w-20">
            <IdCard className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="mb-2 font-display text-sm font-bold uppercase tracking-wider text-orange-600">{t('pass.title')}</p>
            {!revealed ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="grid gap-1 text-xs font-medium text-slate-500">
                  {t('pass.class')}
                  <select className="input-field" value={cc} aria-label={t('pass.class')} onChange={e => { setCc(e.target.value); setSid('') }}>
                    {[101, 201, 301, 401, 501, 601].map(c => <option key={c} value={c}>{c} {clsName(String(c))}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-500">
                  {t('pass.student')}
                  <select className="input-field" value={sid} aria-label={t('pass.student')} onChange={e => setSid(e.target.value)}>
                    <option value="">{t('pass.pickStudent')}</option>
                    {p.students.filter(s => s.classCode === cc).map(s => (
                      <option key={s.student_id} value={s.student_id}>{s.no} {displayStudentName(s, { locale, revealed: false })}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-500">
                  {t('pass.password')}
                  <div className="flex gap-2">
                    <input type="password" className="input-field" value={pwd} onChange={e => setPwd(e.target.value)} aria-label={t('pass.password')} placeholder="10101" />
                    <button type="button" className="btn-primary shrink-0" disabled={!sid || !pwd}
                      onClick={async () => {
                        const r = await p.onLogin(sid, pwd)
                        if (!r.ok) showMsg(r.message, false)
                        else { setPwd(''); showMsg(locale === 'en' ? 'Signed in' : '登入成功', true) }
                      }}>
                      {t('pass.login')}
                    </button>
                  </div>
                </label>
              </div>
            ) : stu && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-amber-100 bg-white/70 px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                  <UserRound className="h-4 w-4 text-orange-500" aria-hidden />
                  {stu.classCode}-{stu.no} {displayStudentName(stu, { locale, revealed: true })}
                </span>
                <span className="badge-pill bg-emerald-100 text-emerald-700"><Ticket className="h-3 w-3" aria-hidden />{t('pass.enrolledCount', { n: nEnrolled })}</span>
                {nWait > 0 && <span className="badge-pill bg-amber-100 text-amber-800">{t('camp.waitlisted')} {nWait}</span>}
                <button type="button" className="btn-ghost !py-1.5 !text-xs" onClick={() => p.onNavigate?.('status')}>{t('front.goStatus')}</button>
                <button type="button" className="btn-ghost !py-1.5 !text-xs" onClick={() => p.onNavigate?.('profile')}>{t('front.goProfile')}</button>
                <button type="button" className="btn-ghost !py-1.5 !text-xs ml-auto" onClick={p.onLogout}><LogOut className="h-3.5 w-3.5" aria-hidden />{t('pass.logout')}</button>
              </div>
            )}
          </div>
        </div>
      </section>

      <Notice msg={msg} ok={msgOk} onClose={() => setMsg('')} />

      {!revealed && (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-white/60 px-4 py-10 text-center text-slate-500">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-amber-400" />
          <p className="font-medium">{t('pass.needLogin')}</p>
        </div>
      )}

      {revealed && stu && (
        <section>
          <h2 className="section-title mb-3 flex items-center gap-2"><Sparkles className="h-5 w-5 text-orange-500" />{t('camp.list')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {p.camps.map(c => {
              const v = validateRegistration(stu, c, c.dates[0], p.regs, p.camps, { profile: profile ?? undefined, settings: p.settings })
              const b = buttonState(v)
              const n = enrolledCount(c.id, p.regs)
              const w = waitlistOf(c.id, p.regs).length
              const tone = capacityTone(n, c.max_capacity)
              const pct = Math.min(100, Math.round((n / Math.max(1, c.max_capacity)) * 100))
              const isSingle = c.attendance_mode === 'single_day_choice'
              const gradeBadge = c.allowed_grades.length >= 6 ? t('camp.gradeAll') : t('camp.gradeRange', { a: c.allowed_grades[0], b: c.allowed_grades[c.allowed_grades.length - 1] })
              return (
                <article key={c.id} className="camp-card flex flex-col p-4">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span className={`badge-pill ${isSingle ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{isSingle ? t('camp.singleDay') : t('camp.fullCourse')}</span>
                    <span className="badge-pill bg-sky-100 text-sky-800">{gradeBadge}</span>
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-800">{campLabel(c, locale)}</h3>
                  <p className="mt-1 text-sm text-slate-500">{c.dates.map(md).join('、')} · {c.start_time}-{c.end_time}{c.location ? ` · ${c.location}` : ''}</p>
                  {c.teacher && <p className="mt-0.5 text-xs text-slate-400">{t('camp.teacher', { t: c.teacher })}</p>}
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className={`font-semibold ${tone.text}`}>{n} / {c.max_capacity}　{t(tone.key)}</span>
                      <span className="text-slate-400">{w > 0 ? t('camp.waitCount', { n: w }) : `${pct}%`}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                  <div className="mt-auto pt-3">
                    <button type="button" disabled={b.disabled || !windowOpen}
                      className={`w-full ${b.kind === 'waitlist' ? 'inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50' : 'btn-primary'}`}
                      onClick={async () => {
                        const result = await p.onEnroll(stu, c)
                        if (!result.ok) showMsg(result.message, false)
                        else showMsg(result.waitlist ? t('camp.waitlistSuccess') : t('camp.success'), true)
                      }}>
                      {btnText(b.kind, b.label)}
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
      )}
    </div>
  )
}
