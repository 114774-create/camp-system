import { ReactNode } from 'react'
import { Compass, Globe2, Lock, LogOut, Printer, Settings2, Sun, Tent, UserRound, Users } from 'lucide-react'
import { Tab } from '../../types'
import { useI18n } from '../../lib/I18nContext'
import { formatTaipei, registrationWindowStatus } from '../../lib/time'
import { SystemSettings } from '../../types'

const STUDENT_TABS: Tab[] = ['front', 'contacts']
const ADMIN_TABS: Tab[] = ['camps', 'students', 'settings', 'r1', 'r2', 'r3']

export default function AppShell({
  tab, onTab, children, settings, isAdminAuthenticated, onAdminLogout, studentLoggedIn,
}: {
  tab: Tab
  onTab: (t: Tab) => void
  children: ReactNode
  settings?: SystemSettings | null
  isAdminAuthenticated: boolean
  onAdminLogout: () => void
  studentLoggedIn: boolean
}) {
  const { t, locale, setLocale } = useI18n()
  const isReport = tab === 'r1' || tab === 'r2' || tab === 'r3'
  const win = registrationWindowStatus(settings?.registration_start_at, settings?.registration_end_at)

  const go = (next: Tab) => onTab(next)

  return (
    <div className="min-h-screen">
      <header className="no-print print:hidden sticky top-0 z-30 border-b border-amber-100 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-sm">
                <Sun className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <h1 className="font-display text-base font-bold leading-tight text-slate-800 sm:text-lg">
                  {t('app.title')}
                </h1>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="badge-pill bg-sky-100 text-sky-700">
                    <Compass className="h-3 w-3" aria-hidden />
                    Qingshan
                  </span>
                  <span className="badge-pill bg-orange-100 text-orange-700">{t('nav.summer')}</span>
                  <span className="badge-pill bg-emerald-100 text-emerald-700">{t('nav.winter')}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label="Language">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold ${locale === 'zh-TW' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}
                  onClick={() => setLocale('zh-TW')}
                >
                  <Globe2 className="h-3.5 w-3.5" aria-hidden />
                  {t('lang.zh')}
                </button>
                <button
                  type="button"
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold ${locale === 'en' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}
                  onClick={() => setLocale('en')}
                >
                  {t('lang.en')}
                </button>
              </div>

              {isAdminAuthenticated && (
                <button type="button" className="btn-ghost !py-2 !text-xs" onClick={onAdminLogout} aria-label={t('nav.adminLogout')}>
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  {t('nav.adminLogout')}
                </button>
              )}
            </div>
          </div>

          {/* Registration window badge */}
          <div className={`rounded-xl border px-3 py-2 text-sm ${
            win.status === 'open' ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : win.status === 'before' ? 'border-amber-200 bg-amber-50 text-amber-950'
                : win.status === 'after' ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}>
            {win.status === 'open' && t('window.open', { t: formatTaipei(win.endAt) })}
            {win.status === 'before' && t('window.before', { t: formatTaipei(win.startAt) })}
            {win.status === 'after' && t('window.after')}
            {win.status === 'unset' && t('window.unset')}
            <span className="ml-2 text-xs opacity-70">TST (Asia/Taipei)</span>
          </div>

          <nav className="flex flex-wrap items-center gap-2" aria-label="Main">
            <div className="inline-flex flex-wrap rounded-2xl border border-amber-200/80 bg-amber-50/60 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => go('front')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${tab === 'front' ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-white/80'}`}
              >
                <Tent className="h-4 w-4" aria-hidden />
                {t('nav.front')}
              </button>
              {studentLoggedIn && (
                <button
                  type="button"
                  onClick={() => go('contacts')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${tab === 'contacts' ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-white/80'}`}
                >
                  <UserRound className="h-4 w-4" aria-hidden />
                  {t('nav.contacts')}
                </button>
              )}
            </div>

            <div className="inline-flex flex-wrap rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-sm">
              <button type="button" onClick={() => go('camps')} className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold sm:text-sm ${tab === 'camps' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-sky-50'}`}>
                <Settings2 className="h-4 w-4" aria-hidden />
                {t('nav.camps')}
              </button>
              <button type="button" onClick={() => go('students')} className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold sm:text-sm ${tab === 'students' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-sky-50'}`}>
                <Users className="h-4 w-4" aria-hidden />
                {t('nav.students')}
              </button>
              <button type="button" onClick={() => go('settings')} className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold sm:text-sm ${tab === 'settings' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-sky-50'}`}>
                <Settings2 className="h-4 w-4" aria-hidden />
                {t('nav.settings')}
              </button>
            </div>

            <div className="inline-flex flex-wrap rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-sm">
              <span className="hidden items-center gap-1 px-2 text-xs font-medium text-slate-500 sm:inline-flex">
                <Printer className="h-3.5 w-3.5" aria-hidden />
                {t('nav.reports')}
              </span>
              {(['r1', 'r2', 'r3'] as Tab[]).map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => go(k)}
                  className={`rounded-xl px-2.5 py-2 text-xs font-semibold sm:text-sm ${tab === k ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-sky-50'}`}
                >
                  {t(`nav.${k}` as 'nav.r1')}
                </button>
              ))}
            </div>

            {isReport && (
              <button type="button" onClick={() => window.print()} className="btn-primary ml-auto sm:ml-0" aria-label={t('nav.print')}>
                <Printer className="h-4 w-4" aria-hidden />
                {t('nav.print')}
              </button>
            )}

            {isAdminAuthenticated && ADMIN_TABS.includes(tab) && (
              <span className="badge-pill bg-emerald-100 text-emerald-700">
                <LogOut className="h-3 w-3 rotate-180" aria-hidden />
                Admin OK
              </span>
            )}
            {STUDENT_TABS.includes(tab) && studentLoggedIn && (
              <span className="badge-pill bg-orange-100 text-orange-700">Student OK</span>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:py-6">{children}</main>
    </div>
  )
}
