import { useState, type FormEvent } from 'react'
import { Lock, ShieldCheck } from 'lucide-react'
import { useI18n } from '../../lib/I18nContext'

export default function AdminGate({
  onVerify,
}: {
  onVerify: (password: string) => Promise<void>
}) {
  const { t } = useI18n()
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await onVerify(pwd)
    } catch {
      setErr(t('admin.wrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md camp-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold">{t('admin.gate')}</h2>
          <p className="text-sm text-slate-500">{t('admin.once')}</p>
        </div>
      </div>
      <form onSubmit={submit} className="grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          {t('admin.password')}
          <input
            type="password"
            className="input-field"
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            autoFocus
            autoComplete="current-password"
            aria-label={t('admin.password')}
          />
        </label>
        {err && <p role="alert" className="text-sm text-rose-600">{err}</p>}
        <button type="submit" className="btn-primary" disabled={busy || !pwd}>
          <Lock className="h-4 w-4" aria-hidden />
          {t('admin.unlock')}
        </button>
      </form>
    </div>
  )
}
