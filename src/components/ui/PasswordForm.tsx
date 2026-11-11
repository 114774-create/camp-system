import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { StudentLoginResult } from '../../types'
import { useI18n } from '../../lib/I18nContext'
import Notice from './Notice'
export default function PasswordForm({ studentId, onChangePassword }: {
  studentId: string
  onChangePassword: (studentId: string, currentPassword: string, next: string) => Promise<StudentLoginResult>
}) {
  const { t } = useI18n()
  const [cur, setCur] = useState(''), [next, setNext] = useState('')
  const [msg, setMsg] = useState(''), [ok, setOk] = useState(false)
  return (
    <section className="camp-card grid gap-3 p-4" aria-label={t('profile.pwdTitle')}>
      <h3 className="flex items-center gap-2 font-display text-base font-bold text-slate-800"><KeyRound className="h-4 w-4 text-orange-500" aria-hidden />{t('profile.pwdTitle')}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">{t('profile.curPwd')}
          <input type="password" className="input-field" value={cur} onChange={e => setCur(e.target.value)} autoComplete="current-password" /></label>
        <label className="grid gap-1 text-sm">{t('pass.changePwd')}
          <input type="password" className="input-field" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" /></label>
      </div>
      <div><button type="button" className="btn-primary" disabled={!cur || next.length < 4}
        onClick={async () => {
          const r = await onChangePassword(studentId, cur, next)
          if (!r.success) { setOk(false); setMsg(r.message); return }
          setCur(''); setNext(''); setOk(true); setMsg(t('profile.pwdOk'))
        }}>{t('pass.changePwd')}</button></div>
      <Notice msg={msg} ok={ok} onClose={() => setMsg('')} />
    </section>
  )
}
