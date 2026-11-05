import { useState } from 'react'
import { Save } from 'lucide-react'
import { PublicSettings } from '../../types'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/time'
import { useI18n } from '../../lib/I18nContext'

export default function SettingsForm({
  settings,
  onSave,
}: {
  settings: PublicSettings
  onSave: (s: PublicSettings, newAdminPassword?: string) => Promise<void>
}) {
  const { locale } = useI18n()
  const [s, setS] = useState(settings)
  const [newAdminPwd, setNewAdminPwd] = useState('')
  const [msg, setMsg] = useState('')

  return (
    <div className="grid max-w-xl gap-4">
      <div>
        <h2 className="section-title">{locale === 'en' ? 'System settings' : '系統設定'}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {locale === 'en'
            ? 'Registration window (Taiwan Standard Time). Admin password is never shown; enter a new one only when rotating.'
            : '報名開放／截止（台灣標準時間）。後台密碼不會顯示於畫面；僅在要更換時填寫新密碼。'}
        </p>
      </div>

      <div className="camp-card grid gap-3 p-4">
        <label className="grid gap-1 text-sm font-medium">
          {locale === 'en' ? 'Term name' : '檔期名稱'}
          <input className="input-field" value={s.term_name} onChange={e => setS({ ...s, term_name: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {locale === 'en' ? 'New admin password (optional)' : '新後台密碼（選填，留空則不變更）'}
          <input
            className="input-field"
            type="password"
            value={newAdminPwd}
            onChange={e => setNewAdminPwd(e.target.value)}
            autoComplete="new-password"
            placeholder={locale === 'en' ? 'Leave blank to keep current' : '留空＝維持原密碼'}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {locale === 'en' ? 'Registration opens (TST)' : '報名開放時間（台灣時間）'}
          <input
            type="datetime-local"
            className="input-field"
            value={toDatetimeLocalValue(s.registration_start_at)}
            onChange={e => setS({ ...s, registration_start_at: fromDatetimeLocalValue(e.target.value) })}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {locale === 'en' ? 'Registration deadline (TST)' : '報名截止時間（台灣時間）'}
          <input
            type="datetime-local"
            className="input-field"
            value={toDatetimeLocalValue(s.registration_end_at)}
            onChange={e => setS({ ...s, registration_end_at: fromDatetimeLocalValue(e.target.value) })}
          />
        </label>
        <button
          type="button"
          className="btn-primary justify-self-start"
          onClick={async () => {
            await onSave(s, newAdminPwd.trim() || undefined)
            setNewAdminPwd('')
            setMsg(locale === 'en' ? 'Settings saved' : '設定已儲存')
          }}
        >
          <Save className="h-4 w-4" />
          {locale === 'en' ? 'Save' : '儲存設定'}
        </button>
        {msg && <p role="alert" className="text-sm text-emerald-700">{msg}</p>}
      </div>
    </div>
  )
}
