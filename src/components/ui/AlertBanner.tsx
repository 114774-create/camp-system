import { Megaphone } from 'lucide-react'
/** 全站緊急公告（颱風停課等）：顯示於所有頁面最上方，列印時隱藏 */
export default function AlertBanner({ message, active }: { message?: string | null; active?: boolean }) {
  const text = (message ?? '').trim()
  if (!active || !text) return null
  const seconds = Math.min(60, Math.max(14, Math.round(text.length * 0.6)))
  return (
    <div role="alert" aria-live="assertive" className="no-print print:hidden relative z-40 flex items-center gap-2 bg-gradient-to-r from-red-600 via-orange-600 to-red-600 px-3 py-2 text-sm font-semibold text-white shadow-md">
      <Megaphone className="h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 overflow-hidden">
        <span className="camp-marquee" style={{ animationDuration: `${seconds}s` }}>{text}</span>
      </div>
    </div>
  )
}
