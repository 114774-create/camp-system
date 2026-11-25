// 即時報名倒數面板：尚未開放／倒數截止／已截止 三種狀態（時間一律以台灣時間 Asia/Taipei 為基準）
import { Camp, PublicSettings } from '../../types'
import { useCountdown } from '../../hooks/useCountdown'
import { aggregateWindowStatus, DAY_MS, formatTaipei } from '../../lib/time'
import { useI18n } from '../../lib/I18nContext'

const pad = (n: number) => String(n).padStart(2, '0')

export default function RegistrationCountdown({ settings, nowMs, camps }: { settings: PublicSettings | null; nowMs: number; camps?: Camp[] }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const win = aggregateWindowStatus(camps ?? [], settings, nowMs)
  const target = win.status === 'before' ? win.startAt : win.status === 'open' && win.endAt ? win.endAt : null
  const cd = useCountdown(target, nowMs)

  if (win.status === 'unset' || (win.status === 'open' && !win.endAt)) return null

  if (win.status === 'after') {
    return (
      <section role="status" aria-label={en ? 'Registration closed' : '報名已截止'}
        className="no-print rounded-2xl border border-slate-300 bg-slate-100 px-4 py-4 text-center text-slate-700 shadow-sm">
        <p className="font-display text-lg font-bold">{en ? '🚫 Registration for this term is closed' : '🚫 本期報名已全面截止'}</p>
        <p className="mt-1 text-xs text-slate-500">{en ? 'Closed at' : '截止時間'}：{formatTaipei(win.endAt)} TST</p>
      </section>
    )
  }

  const upcoming = win.status === 'before'
  const urgent = !upcoming && cd.remainingMs < DAY_MS            // 最後 24 小時：紅色＋呼吸閃爍
  const soon = !upcoming && !urgent && cd.remainingMs < 3 * DAY_MS // 1～3 天：橘色
  const tone = upcoming
    ? { box: 'border-sky-200 bg-sky-50 text-sky-900', tile: 'bg-white/80 text-sky-800', sub: 'text-sky-700' }
    : urgent
      ? { box: 'border-red-300 bg-red-50 text-red-700', tile: 'bg-white text-red-700', sub: 'text-red-600' }
      : soon
        ? { box: 'border-orange-300 bg-orange-50 text-orange-900', tile: 'bg-white/80 text-orange-800', sub: 'text-orange-700' }
        : { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', tile: 'bg-white/80 text-emerald-800', sub: 'text-emerald-700' }

  const title = upcoming
    ? (en ? '⏳ Registration opens in:' : '⏳ 距離報名開放還有：')
    : (en ? '🔥 Registration closes in:' : '🔥 距離報名截止剩餘：')
  const units: [number, string, string][] = en
    ? [[cd.days, 'd', 'days'], [cd.hours, 'h', 'hours'], [cd.minutes, 'm', 'minutes'], [cd.seconds, 's', 'seconds']]
    : [[cd.days, '天', '天'], [cd.hours, '小時', '小時'], [cd.minutes, '分', '分'], [cd.seconds, '秒', '秒']]
  const spoken = `${title} ${cd.days} ${units[0][2]} ${cd.hours} ${units[1][2]} ${cd.minutes} ${units[2][2]} ${cd.seconds} ${units[3][2]}`

  return (
    <section role="timer" aria-live="off" aria-label={spoken} data-phase={upcoming ? 'upcoming' : urgent ? 'urgent' : 'open'}
      className={`no-print rounded-2xl border px-4 py-4 shadow-sm ${tone.box}`}>
      <p className={`font-display text-base font-bold sm:text-lg ${urgent ? 'camp-breath' : ''}`}>{title}</p>
      <div className={`mt-2 flex flex-wrap items-end gap-2 font-display ${urgent ? 'camp-breath' : ''}`} aria-hidden>
        {units.map(([n, label], i) => (
          <span key={i} className={`inline-flex min-w-[4.2rem] flex-col items-center rounded-xl px-3 py-2 shadow-sm ${tone.tile}`}>
            <span className="text-2xl font-extrabold tabular-nums leading-none sm:text-3xl">{i === 0 ? n : pad(n)}</span>
            <span className="mt-1 text-xs font-semibold">{label}</span>
          </span>
        ))}
      </div>
      <p className={`mt-2 text-xs ${tone.sub}`}>
        {upcoming
          ? `${en ? 'Opens at' : '開放時間'}：${formatTaipei(win.startAt)} TST`
          : `${urgent ? (en ? 'Last 24 hours! ' : '最後 24 小時！') : ''}${en ? 'Closes at' : '截止時間'}：${formatTaipei(win.endAt)} TST`}
      </p>
    </section>
  )
}
