import { useEffect, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { EmergencyContact, Student, StudentLoginResult, StudentProfileView } from '../../types'
import { useI18n } from '../../lib/I18nContext'
import { displayStudentName } from '../../lib/maskName'
import { cleanContacts, contactIssues, isValidContactName, isValidTwPhone } from '../../lib/phone'

const blank = (): EmergencyContact => ({ name: '', relation: '', phone: '', is_primary: false })

export default function ContactsPage({
  student,
  profile,
  sessionPassword,
  onSave,
}: {
  student: Student
  profile: StudentProfileView
  sessionPassword: string
  onSave: (contacts: EmergencyContact[], currentPassword: string) => Promise<StudentLoginResult>
}) {
  const { t, locale } = useI18n()
  const [list, setList] = useState<EmergencyContact[]>(profile.emergency_contacts.length ? profile.emergency_contacts : [blank()])
  const [pwd, setPwd] = useState(sessionPassword)
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    setList(profile.emergency_contacts.length ? profile.emergency_contacts : [blank()])
  }, [profile.student_name, profile.emergency_contacts])

  useEffect(() => { setPwd(sessionPassword) }, [sessionPassword])

  const setAt = (i: number, patch: Partial<EmergencyContact>) => {
    setList(prev => prev.map((c, idx) => {
      if (idx !== i) {
        if (patch.is_primary) return { ...c, is_primary: false }
        return c
      }
      return { ...c, ...patch }
    }))
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <div>
        <h2 className="section-title">{t('contact.title')}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {student.classCode}-{student.no} {displayStudentName(student, { locale, revealed: true })}
        </p>
        <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{t('contact.hint')}</p>
      </div>

      {list.map((c, i) => (
        <div key={i} className="camp-card grid gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">#{i + 1}</span>
            <button
              type="button"
              className="text-sm text-rose-600 inline-flex items-center gap-1"
              onClick={() => setList(prev => {
                const next = prev.filter((_, j) => j !== i)
                return next.length ? next : [blank()]
              })}
            >
              <Trash2 className="h-4 w-4" />
              {t('contact.remove')}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">{t('contact.name')}
              <input className="input-field" value={c.name} aria-invalid={!!c.name.trim() && !isValidContactName(c.name)} onChange={e => setAt(i, { name: e.target.value })} />
              {c.name.trim() && !isValidContactName(c.name) && <span className="text-xs text-rose-600">{t('contact.nameBad')}</span>}
            </label>
            <label className="grid gap-1 text-sm">{t('contact.relation')}
              <input className="input-field" value={c.relation} onChange={e => setAt(i, { relation: e.target.value })} placeholder={locale === 'en' ? 'Parent / Guardian' : '父／母／監護人'} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">{t('contact.phone')}
              <input className="input-field" inputMode="tel" maxLength={16} value={c.phone} aria-invalid={!!c.phone.trim() && !isValidTwPhone(c.phone)}
                onChange={e => setAt(i, { phone: e.target.value })} placeholder="0912345678 / 1234567" />
              {c.phone.trim() && !isValidTwPhone(c.phone)
                ? <span className="text-xs text-rose-600">{t('contact.phoneBad')}</span>
                : <span className="text-xs text-slate-400">{t('contact.phoneHint')}</span>}
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-orange-500" checked={c.is_primary} onChange={e => setAt(i, { is_primary: e.target.checked })} />
            {t('contact.primary')}
          </label>
        </div>
      ))}

      <label className="grid gap-1 text-sm font-medium max-w-md">
        {locale === 'en' ? 'Confirm with student password' : '請輸入學生密碼以儲存（伺服器端驗證）'}
        <input type="password" className="input-field" value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="current-password" />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={() => setList(prev => [...prev, blank()])}>
          <Plus className="h-4 w-4" />
          {t('contact.add')}
        </button>
        <button type="button" className="btn-ghost text-rose-600" onClick={() => { setList([blank()]); setOk(true); setMsg(t('contact.clearPending')) }}>
          <Trash2 className="h-4 w-4" />
          {t('contact.clearAll')}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!pwd}
          onClick={async () => {
            const filled = list.filter(c => c.name.trim() || c.phone.trim() || c.relation.trim())
            const issues = contactIssues(filled)
            if (issues.length) { setOk(false); setMsg(issues[0]); return }
            if (filled.length === 0 && !window.confirm(t('contact.clearConfirm'))) return
            const cleaned = cleanContacts(filled)
            const r = await onSave(cleaned, pwd)
            setOk(r.success)
            setMsg(r.success ? (cleaned.length ? t('contact.saved') : t('contact.cleared')) : ('message' in r ? r.message : t('admin.wrong')))
          }}
        >
          <Save className="h-4 w-4" />
          {t('contact.save')}
        </button>
      </div>
      {msg && <p role="alert" className={`text-sm ${ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg}</p>}
    </div>
  )
}
