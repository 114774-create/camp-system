import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { useI18n } from '../../lib/I18nContext'
export default function Notice({ msg, ok, onClose }: { msg: string; ok: boolean; onClose: () => void }) {
  const { t } = useI18n()
  if (!msg) return null
  return (
    <div role="alert" tabIndex={0} onClick={onClose}
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 shadow-sm ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
      {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />}
      <div className="flex-1">
        <p className="font-semibold">{ok ? t('msg.ok') : t('msg.note')}</p>
        <p className="text-sm">{msg}</p>
      </div>
      <span className="text-xs text-slate-400">{t('btn.close')}</span>
    </div>
  )
}
