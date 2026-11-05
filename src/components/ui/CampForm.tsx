import { useState, type ReactNode } from 'react'
import { ArrowLeft, Info, Save } from 'lucide-react'
import { Camp } from '../../types'

export interface CampFormProps { initial: Camp | null; onSave: (c: Camp) => void; onCancel: () => void }

const BLANK: Camp = {
  id: '', term: '115學年度夏令營', season: 'summer', name: '',
  attendance_mode: 'full_course', dates: [], start_time: '09:00', end_time: '12:00',
  allowed_grades: [1, 2, 3, 4, 5, 6], max_capacity: 30,
  ignore_time_conflict: false, allow_concurrent_with: [],
  has_sub_classes: false, sub_classes: [], location: '', teacher: '', notes: '',
}

// 分班輸入格式：「A班:1,2,3;B班:4,5,6」（冒號後為自動分班的年級，可留空）
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
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
          {step}
        </span>
        <h3 className="font-display text-base font-bold text-slate-800">{title}</h3>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  )
}

export default function CampForm({ initial, onSave, onCancel }: CampFormProps) {
  const [c, setC] = useState<Camp>(initial ?? BLANK)
  const [dates, setDates] = useState(c.dates.join(','))
  const [sub, setSub] = useState(subToText(c))
  const [concurrent, setConcurrent] = useState((c.allow_concurrent_with ?? []).join(','))

  const set = <K extends keyof Camp>(k: K, v: Camp[K]) => setC(p => ({ ...p, [k]: v }))

  const submit = () => {
    const ds = dates.split(',').map(x => x.trim()).filter(Boolean).sort()
    if (!c.name || !ds.length) return alert('請填寫營隊名稱與上課日期')
    onSave({
      ...c,
      id: c.id || crypto.randomUUID(),
      dates: ds,
      allow_concurrent_with: concurrent.split(',').map(x => x.trim()).filter(Boolean),
      sub_classes: c.has_sub_classes ? textToSub(sub) : [],
    })
  }

  const L = ({ t, children, htmlFor }: { t: string; children: ReactNode; htmlFor?: string }) => (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700" htmlFor={htmlFor}>
      {t}
      {children}
    </label>
  )

  return (
    <div className="grid max-w-2xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">{initial ? '編輯營隊' : '新增營隊'}</h2>
          <p className="mt-1 text-sm text-slate-500">依三步驟填寫，儲存後即可開放學生報名</p>
        </div>
        <button type="button" onClick={onCancel} className="btn-ghost" aria-label="返回營隊列表">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          返回列表
        </button>
      </div>

      <StepCard step={1} title="基本資訊與日期時間">
        <L t="檔期名稱">
          <input className="input-field" value={c.term} onChange={e => set('term', e.target.value)} aria-label="檔期名稱" />
        </L>
        <L t="營隊名稱">
          <input className="input-field" value={c.name} onChange={e => set('name', e.target.value)} aria-label="營隊名稱" placeholder="例：桌遊營" />
        </L>
        <div className="grid gap-3 sm:grid-cols-2">
          <L t="寒／暑">
            <select className="input-field" value={c.season} onChange={e => set('season', e.target.value as Camp['season'])} aria-label="寒暑">
              <option value="summer">夏令營</option>
              <option value="winter">寒令營</option>
            </select>
          </L>
          <L t="報名模式">
            <select
              className="input-field"
              value={c.attendance_mode}
              onChange={e => set('attendance_mode', e.target.value as Camp['attendance_mode'])}
              aria-label="報名模式"
            >
              <option value="full_course">全程參加</option>
              <option value="single_day_choice">單日擇一場次</option>
            </select>
          </L>
        </div>
        {c.attendance_mode === 'single_day_choice' && (
          <div>
            <L t="場次群組代碼">
              <input
                className="input-field"
                value={c.group_id ?? ''}
                onChange={e => set('group_id', e.target.value)}
                aria-label="場次群組代碼"
                placeholder="例：bake"
              />
            </L>
            <Helper>
              同群組的各日場次請填相同代碼；每場次各建一筆，日期只填一天。學生在同群組內只能擇一參加。
            </Helper>
          </div>
        )}
        <div>
          <L t="上課日期（YYYY-MM-DD，逗號分隔）">
            <input
              className="input-field"
              value={dates}
              onChange={e => setDates(e.target.value)}
              aria-label="上課日期"
              placeholder="例：2026-07-06,2026-07-07,2026-07-08"
            />
          </L>
          <Helper>全程參加可填多日；單日擇一請每筆只填一天。</Helper>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <L t="開始時間">
            <input type="time" className="input-field" value={c.start_time} onChange={e => set('start_time', e.target.value)} aria-label="開始時間" />
          </L>
          <L t="結束時間">
            <input type="time" className="input-field" value={c.end_time} onChange={e => set('end_time', e.target.value)} aria-label="結束時間" />
          </L>
        </div>
        <L t="上課地點">
          <input className="input-field" value={c.location} onChange={e => set('location', e.target.value)} aria-label="上課地點" placeholder="例：會議室" />
        </L>
        <L t="授課講師">
          <input className="input-field" value={c.teacher} onChange={e => set('teacher', e.target.value)} aria-label="授課講師" placeholder="例：王老師" />
        </L>
        <L t="自備物品／注意事項">
          <input className="input-field" value={c.notes} onChange={e => set('notes', e.target.value)} aria-label="注意事項" placeholder="例：自備水壺" />
        </L>
      </StepCard>

      <StepCard step={2} title="年級限制與名額設定">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">開放年級</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map(g => (
              <label
                key={g}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                  c.allowed_grades.includes(g)
                    ? 'border-orange-300 bg-orange-50 font-semibold text-orange-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  className="accent-orange-500"
                  checked={c.allowed_grades.includes(g)}
                  onChange={e => set(
                    'allowed_grades',
                    e.target.checked
                      ? [...c.allowed_grades, g].sort()
                      : c.allowed_grades.filter(x => x !== g),
                  )}
                />
                {g} 年級
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <L t="人數上限">
            <input
              type="number"
              min={1}
              className="input-field max-w-[12rem]"
              value={c.max_capacity}
              onChange={e => set('max_capacity', +e.target.value)}
              aria-label="人數上限"
            />
          </L>
          <Helper>名額以資料庫為最終把關；前端會即時顯示剩餘名額與額滿狀態。</Helper>
        </div>
      </StepCard>

      <StepCard step={3} title="進階規則（分班、單日擇一、共容）">
        <label className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 accent-orange-500"
            checked={c.ignore_time_conflict}
            onChange={e => set('ignore_time_conflict', e.target.checked)}
          />
          <span>
            <span className="font-semibold text-slate-800">允許與同時段營隊同時參加</span>
            <span className="mt-0.5 block text-xs text-slate-500">勾選後，本營隊不與其他營隊做時段衝堂檢核。</span>
          </span>
        </label>

        <div>
          <L t="允許同時參加的營隊 ID（共容設定）">
            <input
              className="input-field"
              value={concurrent}
              onChange={e => setConcurrent(e.target.value)}
              aria-label="共容營隊 ID"
              placeholder="例：c1,c2"
            />
          </L>
          <Helper>填入可同時報名的其他營隊 ID，以逗號分隔。雙向任一方設定即可放行衝堂。</Helper>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 accent-sky-600"
            checked={c.has_sub_classes}
            onChange={e => set('has_sub_classes', e.target.checked)}
          />
          <span>
            <span className="font-semibold text-slate-800">需要分班</span>
            <span className="mt-0.5 block text-xs text-slate-500">啟用後可設定自動分班規則，並於後台手動調整。</span>
          </span>
        </label>

        {c.has_sub_classes && (
          <div>
            <L t="分班設定">
              <input
                className="input-field"
                value={sub}
                onChange={e => setSub(e.target.value)}
                aria-label="分班設定"
                placeholder="A班:1,2,3;B班:4,5,6"
              />
            </L>
            <Helper>
              格式：<code className="rounded bg-slate-100 px-1">A班:1,2,3;B班:4,5,6</code>
              （冒號後為自動分班年級，可留空表示手動分班）。
            </Helper>
          </div>
        )}
      </StepCard>

      <div className="flex flex-wrap gap-2 pb-4">
        <button type="button" onClick={submit} className="btn-primary" aria-label="儲存營隊">
          <Save className="h-4 w-4" aria-hidden />
          儲存
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost" aria-label="取消編輯">
          取消
        </button>
      </div>
    </div>
  )
}
