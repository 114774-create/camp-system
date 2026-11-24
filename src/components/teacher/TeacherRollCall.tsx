// 授課教師專用：手機直式「數位點名簿」。路由 /teacher-rollcall/:camp_id，以營隊 4 碼 PIN 進入（不需總後台密碼）。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getRepo } from '../../data/repo'
import { loadStudents } from '../../services/studentService'
import { AttendStatus, Camp, PublicSettings, RosterEntry, AttendanceMark, Student } from '../../types'
import { applyMark, buildRows, pickDefaultDate, summarize, todayTaipei } from '../../lib/rollcall'
import { md } from '../../lib/validate'
import { campLabel } from '../../lib/report'
import AlertBanner from '../ui/AlertBanner'

const repo = getRepo()
const pinKey = (campId: string) => `camp_teacher_pin:${campId}`
const readPin = (campId: string) => { try { return sessionStorage.getItem(pinKey(campId)) ?? '' } catch { return '' } }
const writePin = (campId: string, pin: string) => { try { pin ? sessionStorage.setItem(pinKey(campId), pin) : sessionStorage.removeItem(pinKey(campId)) } catch { /* ignore */ } }

interface Loaded { camp: Camp; roster: RosterEntry[]; marks: AttendanceMark[] }

export default function TeacherRollCall({ campId }: { campId: string }) {
  const [students, setStudents] = useState<Student[]>([])
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pin, setPin] = useState(() => readPin(campId))
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [date, setDate] = useState('')
  const [sub, setSub] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { loadStudents().then(setStudents); repo.getPublicSettings().then(setSettings).catch(() => {}) }, [])

  const enter = useCallback(async (p: string, keepDate = false) => {
    setBusy(true); setError('')
    try {
      const r = await repo.teacherRoster(campId, p)
      if (!r.success) { setData(null); setPin(''); writePin(campId, ''); setError(r.message); return }
      setData({ camp: r.camp, roster: r.roster, marks: r.marks }); setPin(p); writePin(campId, p)
      if (!keepDate) setDate(pickDefaultDate(r.camp.dates, todayTaipei()))
    } catch { setError('連線失敗，請稍後再試') } finally { setBusy(false) }
  }, [campId])

  useEffect(() => { if (pin && !data) enter(pin) /* 同一分頁重新整理時自動帶入 PIN */ }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => data ? buildRows(data.roster, students, data.marks, date, sub) : [], [data, students, date, sub])
  const sum = summarize(rows)

  const mark = async (studentName: string, current: AttendStatus | undefined, next: AttendStatus) => {
    if (!data) return
    const target = current === next ? null : next            // 再點一次＝撤銷
    const before = data.marks
    setData({ ...data, marks: applyMark(before, studentName, date, target) })   // 樂觀更新
    const r = await repo.teacherMark(campId, pin, studentName, date, target)
    if (!r.success) { setData(d => d && { ...d, marks: before }); setToast(r.message ?? '儲存失敗，請重試'); setTimeout(() => setToast(''), 3000) }
  }

  // ── PIN 輸入畫面 ──
  if (!data) {
    return (
      <>
        <AlertBanner message={settings?.global_alert_message} active={settings?.global_alert_active} />
        <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center gap-4 p-5">
          <h1 className="font-display text-2xl font-bold text-slate-800">教師數位點名簿</h1>
          <p className="text-sm text-slate-500">請輸入行政處提供的 4 碼 PIN。</p>
          <input aria-label="教師 PIN" inputMode="numeric" autoComplete="off" maxLength={4} value={pinInput}
            onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
            className="input-field !py-4 text-center font-mono text-3xl tracking-[0.5em]" placeholder="••••" />
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <button type="button" disabled={busy || pinInput.length !== 4} onClick={() => enter(pinInput)}
            className="rounded-2xl bg-orange-500 py-4 text-lg font-bold text-white disabled:opacity-40">{busy ? '驗證中…' : '進入點名簿'}</button>
        </main>
      </>
    )
  }

  const { camp } = data
  return (
    <>
      <AlertBanner message={settings?.global_alert_message} active={settings?.global_alert_active} />
      <main className="mx-auto max-w-md pb-24">
        <header className="sticky top-0 z-30 border-b border-amber-100 bg-white/95 px-3 pb-2 pt-3 backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="font-display text-xl font-bold leading-tight text-slate-800">{campLabel(camp, 'zh-TW')}</h1>
              <p className="text-xs text-slate-500">{camp.start_time}-{camp.end_time}{camp.location ? ` · ${camp.location}` : ''}</p>
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => enter(pin, true)} disabled={busy} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold">重新整理</button>
              <button type="button" onClick={() => { writePin(campId, ''); setData(null); setPin(''); setPinInput('') }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold">登出</button>
            </div>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="上課日期">
            {[...camp.dates].sort().map(d => (
              <button key={d} type="button" role="tab" aria-selected={d === date} onClick={() => setDate(d)}
                className={`shrink-0 rounded-full px-4 py-2 text-base font-bold ${d === date ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {md(d)}{d === todayTaipei() ? '・今天' : ''}
              </button>
            ))}
          </div>
          {camp.has_sub_classes && camp.sub_classes.length > 0 && (
            <div className="mt-1 flex gap-2 overflow-x-auto">
              {[{ id: '', name: '全部' }, ...camp.sub_classes].map(s => (
                <button key={s.id} type="button" onClick={() => setSub(s.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${sub === s.id ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-700'}`}>{s.name}</button>
              ))}
            </div>
          )}
          <p className="mt-2 text-sm font-semibold text-slate-700">
            應到 {sum.total}　<span className="text-emerald-700">已簽到 {sum.present}</span>　<span className="text-rose-600">缺席 {sum.absent}</span>　<span className="text-slate-400">未點 {sum.pending}</span>
          </p>
        </header>

        {toast && <p role="alert" className="mx-3 mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{toast}</p>}
        {rows.length === 0 && <p className="p-6 text-center text-slate-500">目前沒有應到的學生。</p>}

        <ul className="mt-2 grid gap-3 px-3">
          {rows.map(({ student, entry, status, onLeave }) => (
            <li key={entry.student_name} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold text-slate-800">{student.name}</span>
                <span className="shrink-0 text-sm text-slate-500">{student.classCode}-{student.no}{entry.assigned_sub_class ? `・${entry.assigned_sub_class}` : ''}</span>
              </div>
              {onLeave && <p className="mb-2 inline-block rounded-lg bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-800">家長已請假</p>}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" aria-pressed={status === 'present'} onClick={() => mark(entry.student_name, status, 'present')}
                  className={`h-16 rounded-2xl text-xl font-bold ${status === 'present' ? 'bg-emerald-600 text-white' : 'border-2 border-emerald-600 text-emerald-700'}`}>✅ 簽到</button>
                <button type="button" aria-pressed={status === 'absent'} onClick={() => mark(entry.student_name, status, 'absent')}
                  className={`h-16 rounded-2xl text-xl font-bold ${status === 'absent' ? 'bg-rose-600 text-white' : 'border-2 border-rose-600 text-rose-700'}`}>❌ 缺席</button>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 px-4 text-center text-xs text-slate-400">再點一次已選的按鈕可撤銷。紙本簽到表仍可由行政處列印備用。</p>
      </main>
    </>
  )
}
