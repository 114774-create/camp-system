import {
  Layers, Pencil, Plus, Trash2, Users, Wand2,
} from 'lucide-react'
import { Camp, Registration, Student } from '../../types'
import { campLabel, enrolledJoin } from '../../lib/report'

export interface CampListProps {
  students: Student[]; camps: Camp[]; regs: Registration[]
  onNew: () => void; onEdit: (c: Camp) => void; onDelete: (id: string) => void
  onAutoAssign: (campId: string) => void; onSetSubClass: (regId: string, sc: string) => void
}

function capacityTone(n: number, max: number) {
  if (n >= max) return 'bg-rose-500'
  if (max > 0 && (max - n) / max < 0.2) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export default function CampList(p: CampListProps) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">營隊與分班管理</h2>
          <p className="mt-1 text-sm text-slate-500">新增、編輯營隊，並為報名學生進行分班</p>
        </div>
        <button type="button" onClick={p.onNew} className="btn-primary" aria-label="新增營隊">
          <Plus className="h-4 w-4" aria-hidden />
          新增營隊
        </button>
      </div>

      {p.camps.length === 0 && (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-white/70 px-4 py-12 text-center text-slate-500">
          尚未建立營隊，請點上方「新增營隊」開始設定。
        </div>
      )}

      <div className="grid gap-3">
        {p.camps.map(c => {
          const list = enrolledJoin(c.id, p)
          const pct = Math.min(100, Math.round((list.length / Math.max(1, c.max_capacity)) * 100))
          const isSingle = c.attendance_mode === 'single_day_choice'

          return (
            <article key={c.id} className="camp-card p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span className={`badge-pill ${isSingle ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {isSingle ? '單日擇一場次' : '全程參加'}
                    </span>
                    <span className="badge-pill bg-sky-100 text-sky-800">
                      {c.season === 'winter' ? '寒令營' : '夏令營'}
                    </span>
                    {c.has_sub_classes && (
                      <span className="badge-pill bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                        <Layers className="h-3 w-3" aria-hidden />
                        需分班
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-800">{campLabel(c)}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {c.dates.join('、')} · {c.start_time}-{c.end_time}
                    {c.location ? ` · ${c.location}` : ''}
                    {c.teacher ? ` · ${c.teacher}` : ''}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => p.onEdit(c)}
                    className="btn-ghost !px-3 !py-2"
                    aria-label={`編輯 ${campLabel(c)}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    編輯
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                    aria-label={`刪除 ${campLabel(c)}`}
                    onClick={() => {
                      if (confirm(`刪除「${campLabel(c)}」及其報名紀錄？`)) p.onDelete(c.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    刪除
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    已報名 {list.length} / 名額 {c.max_capacity}
                  </span>
                  <span className="text-slate-400">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={list.length} aria-valuemin={0} aria-valuemax={c.max_capacity}>
                  <div className={`h-full rounded-full transition-all ${capacityTone(list.length, c.max_capacity)}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              {c.has_sub_classes && (
                <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-sky-800">分班管理</p>
                    <button
                      type="button"
                      onClick={() => p.onAutoAssign(c.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-700"
                      aria-label={`依規則自動分班 ${campLabel(c)}`}
                    >
                      <Wand2 className="h-3.5 w-3.5" aria-hidden />
                      依規則自動分班
                    </button>
                  </div>

                  {list.length === 0 ? (
                    <p className="text-sm text-slate-500">尚無報名學生</p>
                  ) : (
                    <ul className="grid gap-2">
                      {list.map(({ r, s }) => (
                        <li
                          key={r.id}
                          className="flex flex-col gap-2 rounded-xl border border-white bg-white/90 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="text-sm font-medium text-slate-700">
                            {s.classCode}-{s.no} {s.name}
                            <span className="ml-2 text-xs font-normal text-slate-400">{s.grade}年級</span>
                          </span>
                          <label className="flex items-center gap-2 text-xs text-slate-500">
                            分班
                            <select
                              className="input-field !w-auto !py-1.5"
                              value={r.assigned_sub_class ?? ''}
                              aria-label={`${s.name} 分班`}
                              onChange={e => p.onSetSubClass(r.id, e.target.value)}
                            >
                              <option value="">未分班</option>
                              {c.sub_classes.map(x => (
                                <option key={x.id} value={x.id}>{x.name}</option>
                              ))}
                            </select>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
