import { useState, type ReactNode } from 'react'
import { ArrowLeft, Info, Save } from 'lucide-react'
import { Camp } from '../../types'
import DateChipsPicker from './DateChipsPicker'
import { useI18n } from '../../lib/I18nContext'
import { buildCamps } from '../../lib/sessions'
import { md } from '../../lib/validate'

export interface CampFormProps { initial: Camp | null; onSave: (camps: Camp[]) => void | Promise<void>; onCancel: () => void }

const BLANK: Camp = {
  id: '', term: '115學年度夏令營', season: 'summer', name: '', name_en: '',
  attendance_mode: 'full_course', dates: [], start_time: '09:00', end_time: '12:00',
  allowed_grades: [1, 2, 3, 4, 5, 6], max_capacity: 30,
  ignore_time_conflict: false, allow_concurrent_with: [],
  has_sub_classes: false, sub_classes: [], location: '', teacher: '', notes: '',
}

const subToText = (c: Camp) => c.sub_classes.map(s => `${s.name}${s.grades ? ':' + s.grades.join(',') : ''}`).join(';')
const textToSub = (t: string) => t.split(';').map(x => x.trim()).filter(Boolean).map(x => {
  const [n, g] = x.split(':')
  return { id: n.trim(), name: n.trim(), grades: g ? g.split(',').map(Number).filter(Boolean) : undefined }
})

function Helper({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

function StepCard({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="camp-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">{step}</span>
        <h3 className="font-display text-base font-bold text-slate-800">{title}</h3>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  )
}

export default function CampForm({ initial, onSave, onCancel }: CampFormProps) {
  const { t, locale } = useI18n()
  const [c, setC] = useState<Camp>(initial ?? BLANK)
  const [dates, setDates] = useState<string[]>(c.dates)
  const [sub, setSub] = useState(subToText(c))
  const [concurrent, setConcurrent] = useState((c.allow_concurrent_with ?? []).join(','))
  const set = <K extends keyof Camp>(k: K, v: Camp[K]) => setC(p => ({ ...p, [k]: v }))

  const single = c.attendance_mode === 'single_day_choice'
  const sessions = single ? [...new Set(dates)].sort() : []

  const submit = () => {
    const r = buildCamps(
      { ...c, allow_concurrent_with: concurrent.split(',').map(x => x.trim()).filter(Boolean), sub_classes: c.has_sub_classes ? textToSub(sub) : [] },
      dates,
      { originalDate: initial?.dates[0] },
    )
    if (!r.ok) return alert(r.error)
    onSave(r.camps)
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">{initial ? (locale === 'en' ? 'Edit camp' : '編輯營隊') : (locale === 'en' ? 'New camp' : '新增營隊')}</h2>
        </div>
        <button type="button" onClick={onCancel} className="btn-ghost">
          <ArrowLeft className="h-4 w-4" />
          {t('btn.cancel')}
        </button>
      </div>

      <StepCard step={1} title={locale === 'en' ? 'Basics & schedule' : '基本資訊與日期時間'}>
        <label className="grid gap-1.5 text-sm font-medium">{locale === 'en' ? 'Term' : '檔期名稱'}
          <input className="input-field" value={c.term} onChange={e => set('term', e.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">{locale === 'en' ? 'Camp name (ZH)' : '營隊名稱'}
          <input className="input-field" value={c.name} onChange={e => set('name', e.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">{locale === 'en' ? 'Camp name (EN, optional)' : '營隊英文名稱（選填）'}
          <input className="input-field" value={c.name_en ?? ''} onChange={e => set('name_en', e.target.value)} placeholder="Board Game Camp" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">{locale === 'en' ? 'Season' : '寒／暑'}
            <select className="input-field" value={c.season} onChange={e => set('season', e.target.value as Camp['season'])}>
              <option value="summer">{t('nav.summer')}</option>
              <option value="winter">{t('nav.winter')}</option>
              <option value="holiday">{t('nav.holiday')}</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">{locale === 'en' ? 'Mode' : '報名模式'}
            <select className="input-field" value={c.attendance_mode} onChange={e => set('attendance_mode', e.target.value as Camp['attendance_mode'])}>
              <option value="full_course">{t('camp.fullCourse')}</option>
              <option value="single_day_choice">{locale === 'en' ? 'Single-day choice' : '單日擇一場次'}</option>
            </select>
          </label>
        </div>
        {c.attendance_mode === 'single_day_choice' && (
          <div>
            <label className="grid gap-1.5 text-sm font-medium">{locale === 'en' ? 'Session group ID (usually leave blank)' : '場次群組代碼（通常不用填，系統自動產生）'}
              <input className="input-field" value={c.group_id ?? ''} onChange={e => set('group_id', e.target.value)} placeholder={locale === 'en' ? 'Leave blank to auto-generate' : '可留空，系統自動產生'} />
            </label>
            <Helper>{locale === 'en' ? 'Leave blank for a new camp — it is generated automatically and the dates below are split into one session per day. Only type a code to add a session to an existing group.' : '新增營隊請留空，系統會自動產生，並把下方選的多個日期拆成「每天一個場次」（同群組學生只能擇一）。只有要把新場次加入既有群組時，才需要填相同的代碼。'}</Helper>
          </div>
        )}
        <DateChipsPicker value={dates} onChange={setDates} label={locale === 'en' ? 'Camp dates' : '上課日期'} />
        {single && sessions.length > 0 && (
          <p className="rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2 text-sm text-sky-900">
            {locale === 'en'
              ? `Will create ${sessions.length} session(s): ${sessions.map(md).join(', ')} — each capped at ${c.max_capacity}.`
              : `儲存後將建立 ${sessions.length} 個場次：${sessions.map(md).join('、')}，每個場次各自上限 ${c.max_capacity} 人。`}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">{locale === 'en' ? 'Start' : '開始時間'}
            <input type="time" className="input-field" value={c.start_time} onChange={e => set('start_time', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">{locale === 'en' ? 'End' : '結束時間'}
            <input type="time" className="input-field" value={c.end_time} onChange={e => set('end_time', e.target.value)} />
          </label>
        </div>
        <label className="grid gap-1.5 text-sm font-medium">{locale === 'en' ? 'Location' : '上課地點'}
          <input className="input-field" value={c.location} onChange={e => set('location', e.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">{locale === 'en' ? 'Teacher' : '授課講師'}
          <input className="input-field" value={c.teacher} onChange={e => set('teacher', e.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">{locale === 'en' ? 'Notes' : '自備物品／注意事項'}
          <input className="input-field" value={c.notes} onChange={e => set('notes', e.target.value)} />
        </label>
      </StepCard>

      <StepCard step={2} title={locale === 'en' ? 'Grades & capacity' : '年級限制與名額設定'}>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{locale === 'en' ? 'Allowed grades' : '開放年級'}</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map(g => (
              <label key={g} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${c.allowed_grades.includes(g) ? 'border-orange-300 bg-orange-50 font-semibold text-orange-700' : 'border-slate-200 bg-white'}`}>
                <input type="checkbox" className="accent-orange-500" checked={c.allowed_grades.includes(g)} onChange={e => set('allowed_grades', e.target.checked ? [...c.allowed_grades, g].sort() : c.allowed_grades.filter(x => x !== g))} />
                {t('grade.n', { n: g })}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="grid gap-1.5 text-sm font-medium max-w-[12rem]">
            {single ? (locale === 'en' ? 'Capacity per session' : '每一場次人數上限') : (locale === 'en' ? 'Capacity' : '人數上限')}
            <input type="number" min={1} className="input-field" value={c.max_capacity} onChange={e => set('max_capacity', +e.target.value)} />
          </label>
          {single && <Helper>{locale === 'en' ? 'Applies to each day separately (e.g. 2 days × 30).' : '每個日期場次各自計算，例如 2 天、上限 30，就是每天各 30 人。'}</Helper>}
        </div>
      </StepCard>

      <StepCard step={3} title={locale === 'en' ? 'Advanced rules' : '進階規則（分班、共容）'}>
        <label className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-3 text-sm">
          <input type="checkbox" className="mt-0.5 accent-orange-500" checked={c.ignore_time_conflict} onChange={e => set('ignore_time_conflict', e.target.checked)} />
          <span>{locale === 'en' ? 'Allow concurrent with overlapping camps' : '允許與同時段營隊同時參加'}</span>
        </label>
        <div>
          <label className="grid gap-1.5 text-sm font-medium">{locale === 'en' ? 'Allow concurrent camp IDs' : '允許同時參加的營隊 ID'}
            <input className="input-field" value={concurrent} onChange={e => setConcurrent(e.target.value)} placeholder="c1,c2" />
          </label>
          <Helper>{locale === 'en' ? 'Comma-separated camp IDs that may overlap.' : '以逗號分隔可同時報名的其他營隊 ID。'}</Helper>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-3 text-sm">
          <input type="checkbox" className="mt-0.5 accent-sky-600" checked={c.has_sub_classes} onChange={e => set('has_sub_classes', e.target.checked)} />
          <span>{locale === 'en' ? 'Needs sub-classes' : '需要分班'}</span>
        </label>
        {c.has_sub_classes && (
          <div>
            <label className="grid gap-1.5 text-sm font-medium">{locale === 'en' ? 'Sub-class rules' : '分班設定'}
              <input className="input-field" value={sub} onChange={e => setSub(e.target.value)} placeholder="A班:1,2,3;B班:4,5,6" />
            </label>
            <Helper>A班:1,2,3;B班:4,5,6</Helper>
          </div>
        )}
      </StepCard>

      <div className="flex flex-wrap gap-2 pb-4">
        <button type="button" onClick={submit} className="btn-primary"><Save className="h-4 w-4" />{t('btn.save')}</button>
        <button type="button" onClick={onCancel} className="btn-ghost">{t('btn.cancel')}</button>
      </div>
    </div>
  )
}
