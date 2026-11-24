// 忘記密碼／帳號解鎖：學號 + 主要緊急聯絡人電話
import { useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { ResetPasswordResult } from '../../types'
import { isValidTwPhone, PHONE_RULE_ZH } from '../../lib/phone'
import { useI18n } from '../../lib/I18nContext'
import Notice from './Notice'

export default function ForgotPasswordPanel({ onReset }: {
  /** newPassword 為 null＝重設回預設密碼（目前學號） */
  onReset: (studentId: string, phone: string, newPassword: string | null) => Promise<ResetPasswordResult>
}) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const [id, setId] = useState(''), [phone, setPhone] = useState('')
  const [pwd, setPwd] = useState(''), [pwd2, setPwd2] = useState('')
  const [msg, setMsg] = useState(''), [ok, setOk] = useState(false), [busy, setBusy] = useState(false)
  const submit = async () => {
    if (id.trim().length < 5) { setOk(false); return setMsg(en ? 'Enter the 5-digit student ID.' : '請輸入 5 碼學號') }
    if (!isValidTwPhone(phone)) { setOk(false); return setMsg(`${en ? 'Invalid phone. ' : '電話格式不正確：'}${PHONE_RULE_ZH}`) }
    // 新密碼為選填：留空＝重設回預設密碼（目前學號）；有填＝自訂新密碼
    if (pwd && pwd.length < 4) { setOk(false); return setMsg(en ? 'New password needs at least 4 characters.' : '新密碼至少 4 碼（或留空以重設為預設密碼）') }
    if (pwd !== pwd2) { setOk(false); return setMsg(en ? 'Passwords do not match.' : '兩次輸入的新密碼不一致') }
    setBusy(true)
    const r = await onReset(id, phone, pwd || null)
    setBusy(false); setOk(r.success); setMsg(r.message)
    if (r.success) { setPwd(''); setPwd2('') }
  }
  return (
    <section className="no-print camp-card grid gap-3 p-4" aria-label={en ? 'Forgot password' : '忘記密碼／帳號解鎖'}>
      <h3 className="flex items-center gap-2 font-display text-base font-bold text-slate-800"><LockKeyhole className="h-4 w-4 text-orange-500" aria-hidden />{en ? 'Forgot password / unlock account' : '忘記密碼／帳號解鎖'}</h3>
      <p className="text-sm text-slate-600">
        {en ? 'Enter the student ID and the phone number of the PRIMARY emergency contact on file. If they match, the account is unlocked. Leave the new password blank to reset to the default password (the current student ID).'
          : '請輸入學號，以及系統內記錄的「主要緊急聯絡人」電話。比對相符就會解除鎖定。新密碼留空＝重設回預設密碼（目前的學號）；有填＝使用你設定的新密碼。（從未填寫過聯絡人，或電話已更換，請洽學校行政人員。連續錯誤 5 次，此功能會暫停 30 分鐘。）'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">{en ? 'Student ID' : '學號'}<input className="input-field" inputMode="numeric" maxLength={5} value={id} onChange={e => setId(e.target.value.replace(/\D/g, ''))} /></label>
        <label className="grid gap-1 text-sm">{en ? 'Primary contact phone' : '主要聯絡人電話'}<input className="input-field" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0912345678" /></label>
        <label className="grid gap-1 text-sm">{en ? 'New password (optional)' : '新密碼（選填）'}<input className="input-field" type="password" value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="new-password" /></label>
        <label className="grid gap-1 text-sm">{en ? 'Confirm new password' : '再輸入一次新密碼'}<input className="input-field" type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} autoComplete="new-password" /></label>
      </div>
      <div><button type="button" className="btn-primary" disabled={busy} onClick={submit}>{en ? 'Reset password & unlock' : '重設密碼並解鎖'}</button></div>
      <Notice msg={msg} ok={ok} onClose={() => setMsg('')} />
    </section>
  )
}
