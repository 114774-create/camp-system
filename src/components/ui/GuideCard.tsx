import { AlertTriangle, CheckCircle2, ClipboardPen, IdCard, ListChecks } from 'lucide-react'
import { useI18n } from '../../lib/I18nContext'
export default function GuideCard() {
  const { t } = useI18n()
  const steps = [
    { icon: ListChecks, title: t('guide.s1'), body: t('guide.s1d') },
    { icon: ClipboardPen, title: t('guide.s2'), body: t('guide.s2d') },
    { icon: CheckCircle2, title: t('guide.s3'), body: t('guide.s3d') },
  ]
  return (
    <details open className="no-print rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 shadow-soft">
      <summary className="cursor-pointer select-none px-4 py-3 font-display text-base font-bold text-sky-800">{t('guide.title')}</summary>
      <div className="grid gap-4 px-4 pb-4">
        <div className="flex gap-3 rounded-xl border border-sky-100 bg-white/80 p-3">
          <IdCard className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" aria-hidden />
          <div><p className="text-sm font-semibold text-slate-800">{t('guide.login.title')}</p><p className="text-sm text-slate-600">{t('guide.login.body')}</p></div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">{t('guide.steps')}</p>
          <ol className="grid gap-2 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-emerald-100 bg-white/80 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">{i + 1}</span>
                <div><p className="flex items-center gap-1 text-sm font-semibold text-slate-800"><s.icon className="h-4 w-4 text-emerald-600" aria-hidden />{s.title}</p><p className="text-xs text-slate-600">{s.body}</p></div>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-1 flex items-center gap-1 text-sm font-semibold text-amber-900"><AlertTriangle className="h-4 w-4" aria-hidden />{t('guide.warn.title')}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            <li>{t('guide.warn.conflict')}</li><li>{t('guide.warn.single')}</li><li>{t('guide.warn.waitlist')}</li>
          </ul>
        </div>
      </div>
    </details>
  )
}
