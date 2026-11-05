import { Layers, Pencil, Plus, Trash2, Users, Wand2 } from 'lucide-react'
import { Camp, Registration, Student } from '../../types'
import { campLabel, enrolledJoin } from '../../lib/report'
import { useI18n } from '../../lib/I18nContext'

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
  const { t, locale } = useI18n()
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">{t('nav.camps')}</h2>
        </div>
        <button type="button" onClick={p.onNew} className="btn-primary" aria-label="new camp">
          <Plus className="h-4 w-4" />
          {locale === 'en' ? 'New camp' : '新增營隊'}
        </button>
      </div>

      <div className="grid gap-3">
        {p.camps.map(c => {
          const list = enrolledJoin(c.id, p)
          const pct = Math.min(100, Math.round((list.length / Math.max(1, c.max_capacity)) * 100))
          const isSingle = c.attendance_mode === 'single_day_choice'
          return (
            <article key={c.id} className="camp-card p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span className={`badge-pill ${isSingle ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {isSingle ? t('camp.singleDay') : t('camp.fullCourse')}
                    </span>
                    <span className="badge-pill bg-sky-100 text-sky-800">{c.season === 'winter' ? t('nav.winter') : t('nav.summer')}</span>
                    {c.has_sub_classes && (
                      <span className="badge-pill bg-violet-50 text-violet-700"><Layers className="h-3 w-3" />{locale === 'en' ? 'Sub-classes' : '需分班'}</span>
                    )}
                  </div>
                  <h3 className="font-display text-lg font-bold">{campLabel(c, locale)}</h3>
                  <p className="mt-1 text-sm text-slate-500">{c.dates.join('、')} · {c.start_time}-{c.end_time}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => p.onEdit(c)} className="btn-ghost !px-3 !py-2"><Pencil className="h-4 w-4" />{locale === 'en' ? 'Edit' : '編輯'}</button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600"
                    onClick={() => { if (confirm(locale === 'en' ? `Delete 「${campLabel(c, locale)}」?` : `刪除「${campLabel(c, locale)}」及其報名紀錄？`)) p.onDelete(c.id) }}
                  >
                    <Trash2 className="h-4 w-4" />{locale === 'en' ? 'Delete' : '刪除'}
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-600"><Users className="h-3.5 w-3.5" />{list.length} / {c.max_capacity}</span>
                  <span className="text-slate-400">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${capacityTone(list.length, c.max_capacity)}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              {c.has_sub_classes && (
                <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-sky-800">{locale === 'en' ? 'Sub-class management' : '分班管理'}</p>
                    <button type="button" onClick={() => p.onAutoAssign(c.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white">
                      <Wand2 className="h-3.5 w-3.5" />{locale === 'en' ? 'Auto-assign' : '依規則自動分班'}
                    </button>
                  </div>
                  <ul className="grid gap-2">
                    {list.map(({ r, s }) => (
                      <li key={r.id} className="flex flex-col gap-2 rounded-xl border border-white bg-white/90 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm font-medium">{s.classCode}-{s.no} {s.name}</span>
                        <select className="input-field !w-auto !py-1.5" value={r.assigned_sub_class ?? ''} onChange={e => p.onSetSubClass(r.id, e.target.value)}>
                          <option value="">{locale === 'en' ? 'Unassigned' : '未分班'}</option>
                          {c.sub_classes.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
