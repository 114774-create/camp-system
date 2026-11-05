import { useMemo, useState } from 'react'
import { CalendarPlus, X } from 'lucide-react'

function pad(n: number) { return String(n).padStart(2, '0') }
function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function expandRange(start: string, end: string, excludeWeekend: boolean) {
  const out: string[] = []
  const a = new Date(start + 'T00:00:00')
  const b = new Date(end + 'T00:00:00')
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) return out
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const day = d.getDay()
    if (excludeWeekend && (day === 0 || day === 6)) continue
    out.push(toISODate(d))
  }
  return out
}

export default function DateChipsPicker({
  value,
  onChange,
  label = '上課日期',
}: {
  value: string[]
  onChange: (dates: string[]) => void
  label?: string
}) {
  const [single, setSingle] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [excludeWeekend, setExcludeWeekend] = useState(true)

  const sorted = useMemo(() => [...value].sort(), [value])

  const addOne = () => {
    if (!single || value.includes(single)) return
    onChange([...value, single].sort())
    setSingle('')
  }

  const addRange = () => {
    const extra = expandRange(rangeStart, rangeEnd, excludeWeekend)
    if (!extra.length) return
    onChange([...new Set([...value, ...extra])].sort())
  }

  const remove = (d: string) => onChange(value.filter(x => x !== d))

  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium text-slate-700">{label}</p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-slate-500">
          加入單日
          <input type="date" className="input-field !w-auto" value={single} onChange={e => setSingle(e.target.value)} />
        </label>
        <button type="button" className="btn-ghost !py-2" onClick={addOne} disabled={!single}>
          <CalendarPlus className="h-4 w-4" aria-hidden />
          加入
        </button>
      </div>

      <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
        <p className="mb-2 text-xs font-semibold text-sky-800">選擇起訖日期區間</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-slate-500">
            開始
            <input type="date" className="input-field !w-auto" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs text-slate-500">
            結束
            <input type="date" className="input-field !w-auto" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" className="accent-sky-600" checked={excludeWeekend} onChange={e => setExcludeWeekend(e.target.checked)} />
            排除週末
          </label>
          <button type="button" className="btn-primary !py-2" onClick={addRange} disabled={!rangeStart || !rangeEnd}>
            展開加入
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 min-h-[2.5rem]">
        {sorted.length === 0 && <span className="text-sm text-slate-400">尚未選擇日期</span>}
        {sorted.map(d => (
          <span key={d} className="badge-pill bg-orange-100 text-orange-800 ring-1 ring-orange-200 !py-1 !text-sm">
            {d}
            <button type="button" className="ml-1 rounded-full p-0.5 hover:bg-orange-200" aria-label={`移除 ${d}`} onClick={() => remove(d)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
