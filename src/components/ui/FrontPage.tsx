import { useState } from 'react'
import {
  AlertCircle, CalendarDays, CheckCircle2, Clock, IdCard, MapPin,
  Sparkles, Ticket, UserRound, XCircle,
} from 'lucide-react'
import { Camp, Registration, Student } from '../../types'
import { buttonState, md, validateRegistration, VResult } from '../../lib/validate'
import { campLabel, clsName } from '../../lib/report'

export interface FrontPageProps {
  students: Student[]; camps: Camp[]; regs: Registration[]
  onEnroll: (s: Student, c: Camp) => Promise<VResult>; onCancel: (regId: string) => Promise<void>
}

const GRADE_LABEL = ['', '一年級', '二年級', '三年級', '四年級', '五年級', '六年級']

function capacityTone(n: number, max: number) {
  if (n >= max) return { bar: 'bg-rose-500', text: 'text-rose-600', label: '額滿' }
  if (max > 0 && (max - n) / max < 0.2) return { bar: 'bg-amber-500', text: 'text-amber-700', label: '即將額滿' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-700', label: '名額充裕' }
}

function ModeBadge({ mode }: { mode: Camp['attendance_mode'] }) {
  if (mode === 'single_day_choice') {
    return (
      <span className="badge-pill bg-amber-100 text-amber-800 ring-1 ring-amber-200">
        單日擇一場次 · 多日擇一參加
      </span>
    )
  }
  return (
    <span className="badge-pill bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200">
      全程參加
    </span>
  )
}

function GradeBadge({ grades }: { grades: number[] }) {
  const all = grades.length >= 6
  return (
    <span className="badge-pill bg-sky-100 text-sky-800 ring-1 ring-sky-200">
      {all ? '不限年級・後台分班' : `限 ${grades[0]}~${grades[grades.length - 1]} 年級`}
    </span>
  )
}

export default function FrontPage({ students, camps, regs, onEnroll, onCancel }: FrontPageProps) {
  const [cc, setCc] = useState('101')
  const [sid, setSid] = useState('')
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(false)

  const stu = students.find(s => s.student_id === sid)
  const mine = regs.filter(r => r.student_id === sid && r.status === 'enrolled')
  const classStudents = students.filter(s => s.classCode === cc)

  const showMsg = (text: string, ok = false) => {
    setMsg(text)
    setMsgOk(ok)
  }

  return (
    <div className="grid gap-5">
      {/* Student Pass */}
      <section
        className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-orange-50 via-white to-amber-50 shadow-soft"
        aria-label="學生專屬通行證"
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-200/40 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-sky-200/30 blur-2xl" />

        <div className="relative grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:items-center sm:p-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-md sm:h-20 sm:w-20">
            <IdCard className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden />
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="font-display text-sm font-bold uppercase tracking-wider text-orange-600">
                Student Pass · 學生專屬通行證
              </p>
              {stu && (
                <span className="badge-pill bg-orange-500 text-white">{GRADE_LABEL[stu.grade]}</span>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="grid flex-1 gap-1 text-xs font-medium text-slate-500">
                選擇班級（101~601）
                <select
                  className="input-field"
                  value={cc}
                  aria-label="選擇班級"
                  onChange={e => { setCc(e.target.value); setSid('') }}
                >
                  {[101, 201, 301, 401, 501, 601].map(c => (
                    <option key={c} value={c}>{c} {clsName(String(c))}</option>
                  ))}
                </select>
              </label>
              <label className="grid flex-[1.4] gap-1 text-xs font-medium text-slate-500">
                選擇座號／學生姓名
                <select
                  className="input-field"
                  value={sid}
                  aria-label="選擇學生"
                  onChange={e => setSid(e.target.value)}
                >
                  <option value="">請選擇學生</option>
                  {classStudents.map(s => (
                    <option key={s.student_id} value={s.student_id}>{s.no}號 {s.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {stu && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-amber-100 bg-white/70 px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                  <UserRound className="h-4 w-4 text-orange-500" aria-hidden />
                  {stu.classCode}-{stu.no} {stu.name}
                </span>
                {stu.ename && <span className="text-slate-500">EN: {stu.ename}</span>}
                <span className="badge-pill bg-emerald-100 text-emerald-700">
                  <Ticket className="h-3 w-3" aria-hidden />
                  已報名 {mine.length} 個營隊
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Toast / Alert */}
      {msg && (
        <div
          role="alert"
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 shadow-sm transition hover:opacity-95 ${
            msgOk
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-300 bg-amber-50 text-amber-950'
          }`}
          onClick={() => setMsg('')}
          onKeyDown={e => e.key === 'Enter' && setMsg('')}
          tabIndex={0}
          aria-label="點擊關閉提示"
        >
          {msgOk
            ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{msgOk ? '完成' : '請留意'}</p>
            <p className="mt-0.5 text-sm leading-relaxed">{msg}</p>
          </div>
          <span className="text-xs text-slate-400">點擊關閉</span>
        </div>
      )}

      {!stu && (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-white/60 px-4 py-10 text-center text-slate-500">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-amber-400" aria-hidden />
          <p className="font-medium">請先選擇班級與學生，開始報名營隊</p>
          <p className="mt-1 text-sm">選好通行證後，即可查看可報名營隊與個人行程</p>
        </div>
      )}

      {stu && (
        <>
          {/* My registrations timeline */}
          {mine.length > 0 && (
            <section aria-label="我的已報名行程">
              <h2 className="section-title mb-3 flex items-center gap-2">
                <Ticket className="h-5 w-5 text-orange-500" aria-hidden />
                我的已報名行程
              </h2>
              <ol className="relative space-y-3 border-l-2 border-orange-200 pl-5">
                {mine.map(r => {
                  const c = camps.find(x => x.id === r.camp_id)
                  if (!c) return null
                  const sub = c.sub_classes.find(sc => sc.id === r.assigned_sub_class)
                  return (
                    <li key={r.id} className="relative">
                      <span className="absolute -left-[1.4rem] top-4 h-3 w-3 rounded-full border-2 border-white bg-orange-500 shadow" />
                      <div className="camp-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">{campLabel(c)}</p>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                              {c.dates.map(md).join('、')}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" aria-hidden />
                              {c.start_time}-{c.end_time}
                            </span>
                            {c.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" aria-hidden />
                                {c.location}
                              </span>
                            )}
                            {sub && (
                              <span className="badge-pill bg-sky-100 text-sky-700">分班：{sub.name}</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                          aria-label={`取消報名 ${campLabel(c)}`}
                          onClick={async () => {
                            await onCancel(r.id)
                            showMsg('已取消，名額已釋出', true)
                          }}
                        >
                          <XCircle className="h-4 w-4" aria-hidden />
                          取消報名
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          )}

          {/* Camp cards */}
          <section aria-label="可報名營隊">
            <h2 className="section-title mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" aria-hidden />
              可報名營隊
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {camps.map(c => {
                const v = validateRegistration(stu, c, c.dates[0], regs, camps)
                const b = buttonState(v)
                const n = regs.filter(r => r.camp_id === c.id && r.status === 'enrolled').length
                const tone = capacityTone(n, c.max_capacity)
                const pct = Math.min(100, Math.round((n / Math.max(1, c.max_capacity)) * 100))

                return (
                  <article key={c.id} className="camp-card flex flex-col p-4">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <ModeBadge mode={c.attendance_mode} />
                      <GradeBadge grades={c.allowed_grades} />
                      {c.has_sub_classes && (
                        <span className="badge-pill bg-sky-50 text-sky-700 ring-1 ring-sky-100">含分班</span>
                      )}
                    </div>

                    <h3 className="font-display text-base font-bold text-slate-800">{campLabel(c)}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {c.dates.map(md).join('、')} · {c.start_time}-{c.end_time}
                      {c.location ? ` · ${c.location}` : ''}
                    </p>
                    {c.teacher && <p className="mt-0.5 text-xs text-slate-400">講師：{c.teacher}</p>}

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className={`font-semibold ${tone.text}`}>
                          {n} / {c.max_capacity}　{tone.label}
                        </span>
                        <span className="text-slate-400">{pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={c.max_capacity} aria-label="名額進度">
                        <div className={`h-full rounded-full transition-all duration-300 ${tone.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="mt-auto pt-3">
                      <button
                        type="button"
                        disabled={b.disabled}
                        aria-label={`${b.label} ${campLabel(c)}`}
                        className="btn-primary w-full"
                        onClick={async () => {
                          const result = await onEnroll(stu, c)
                          showMsg(result.ok ? '報名成功' : result.message, result.ok)
                        }}
                      >
                        {b.label}
                      </button>

                      {!v.ok && (
                        <div
                          className={`alert-pill ${
                            b.disabled
                              ? 'border-amber-200 bg-amber-50 text-amber-900'
                              : 'border-sky-200 bg-sky-50 text-sky-900'
                          }`}
                        >
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          <span className="leading-relaxed">{v.message}</span>
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
