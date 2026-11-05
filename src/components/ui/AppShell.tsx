import { ReactNode } from 'react'
import { Tent, Compass, Printer, Settings2, Sun } from 'lucide-react'

export type Tab = 'front' | 'camps' | 'r1' | 'r2' | 'r3'

const MAIN_TABS: { key: Tab; label: string; icon: typeof Tent; group?: 'main' | 'report' }[] = [
  { key: 'front', label: '學生報名首頁', icon: Tent, group: 'main' },
  { key: 'camps', label: '後台營隊與分班管理', icon: Settings2, group: 'main' },
]

const REPORT_TABS: { key: Tab; label: string }[] = [
  { key: 'r1', label: '班級簽到表' },
  { key: 'r2', label: '總簽到表' },
  { key: 'r3', label: '報名通知單' },
]

export default function AppShell({ tab, onTab, children }: { tab: Tab; onTab: (t: Tab) => void; children: ReactNode }) {
  const isReport = tab === 'r1' || tab === 'r2' || tab === 'r3'

  return (
    <div className="min-h-screen">
      <header className="no-print print:hidden sticky top-0 z-30 border-b border-amber-100 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-sm">
              <Sun className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h1 className="font-display text-base font-bold leading-tight text-slate-800 sm:text-lg">
                國小寒夏令營報名系統
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="badge-pill bg-sky-100 text-sky-700">
                  <Compass className="h-3 w-3" aria-hidden />
                  行政管理
                </span>
                <span className="badge-pill bg-orange-100 text-orange-700">夏令營</span>
                <span className="badge-pill bg-emerald-100 text-emerald-700">寒令營</span>
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2" aria-label="主要導覽">
            <div className="inline-flex rounded-2xl border border-amber-200/80 bg-amber-50/60 p-1 shadow-sm">
              {MAIN_TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onTab(key)}
                  aria-current={tab === key ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    tab === key
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white/80 hover:text-orange-600'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{key === 'front' ? '報名' : '後台'}</span>
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-sm">
              <span className="hidden items-center gap-1 px-2 text-xs font-medium text-slate-500 sm:inline-flex">
                <Printer className="h-3.5 w-3.5" aria-hidden />
                報表
              </span>
              {REPORT_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onTab(key)}
                  aria-current={tab === key ? 'page' : undefined}
                  className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition sm:text-sm ${
                    tab === key
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-sky-50 hover:text-sky-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {isReport && (
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary ml-auto sm:ml-0"
                aria-label="列印目前報表"
              >
                <Printer className="h-4 w-4" aria-hidden />
                列印
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:py-6">{children}</main>
    </div>
  )
}
