import { useMemo, useState } from 'react'
import { KeyRound, LockOpen, Plus, Save, ShieldAlert, Trash2 } from 'lucide-react'
import { EmergencyContact, Student, StudentProfile } from '../../types'
import { useI18n } from '../../lib/I18nContext'
import { displayStudentName } from '../../lib/maskName'
import { clsName } from '../../lib/report'

const blank = (): EmergencyContact => ({ name: '', relation: '', phone: '', is_primary: false })

export default function StudentAdmin({
  students,
  profiles,
  getProfile,
  onUnlock,
  onResetPassword,
  onSaveContacts,
}: {
  students: Student[]
  profiles: StudentProfile[]
  getProfile: (id: string) => StudentProfile
  onUnlock: (id: string) => Promise<void>
  onResetPassword: (id: string) => Promise<void>
  onSaveContacts: (id: string, contacts: EmergencyContact[]) => Promise<void>
}) {
  const { locale } = useI18n()
  const [cc, setCc] = useState('101')
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EmergencyContact[]>([])
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    return students
      .filter(s => s.classCode === cc)
      .filter(s => !q || s.name.includes(q) || s.student_id.includes(q) || (s.ename ?? '').toLowerCase().includes(q.toLowerCase()))
  }, [students, cc, q])

  const openEdit = (id: string) => {
    const p = getProfile(id)
    setEditId(id)
    setDraft(p.emergency_contacts.length ? p.emergency_contacts.map(c => ({ ...c })) : [blank()])
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="section-title">{locale === 'en' ? 'All students & emergency contacts' : '全校學生與緊急聯絡人管理'}</h2>
        <p className="mt-1 text-sm text-slate-500">{locale === 'en' ? 'Unlock accounts, reset passwords, edit contacts.' : '解鎖帳號、重設密碼、代為編輯緊急聯絡人。'}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input-field !w-auto" value={cc} onChange={e => setCc(e.target.value)}>
          {[101, 201, 301, 401, 501, 601].map(c => <option key={c} value={c}>{c} {clsName(String(c))}</option>)}
        </select>
        <input className="input-field max-w-xs" placeholder={locale === 'en' ? 'Search name / ID' : '搜尋姓名／學號'} value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-amber-200/70 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-amber-50/80 text-left">
            <tr>
              {(locale === 'en'
                ? ['ID', 'Class', 'No', 'Name', 'English', 'Status', 'Contacts', 'Actions']
                : ['學號', '班級', '座號', '中文姓名', '英文姓名', '帳號狀態', '緊急聯絡人', '操作']
              ).map(h => <th key={h} className="border-b border-amber-100 px-3 py-2 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map(s => {
              const p = getProfile(s.student_id)
              return (
                <tr key={s.student_id} className="align-top hover:bg-orange-50/40">
                  <td className="border-b border-slate-100 px-3 py-2 font-mono text-xs">{s.student_id}</td>
                  <td className="border-b border-slate-100 px-3 py-2">{s.classCode}</td>
                  <td className="border-b border-slate-100 px-3 py-2">{s.no}</td>
                  <td className="border-b border-slate-100 px-3 py-2 font-medium">{displayStudentName(s, { locale: 'zh-TW', revealed: true })}</td>
                  <td className="border-b border-slate-100 px-3 py-2">{s.ename ?? '—'}</td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    {p.is_locked ? (
                      <span className="badge-pill bg-rose-100 text-rose-700"><ShieldAlert className="h-3 w-3" />{locale === 'en' ? 'Locked' : '已鎖定'} ({p.failed_attempts})</span>
                    ) : (
                      <span className="badge-pill bg-emerald-100 text-emerald-700">{locale === 'en' ? 'OK' : '正常'}{p.failed_attempts ? ` · ${p.failed_attempts}` : ''}</span>
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    {p.emergency_contacts.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {p.emergency_contacts.map((c, i) => (
                          <li key={i} className="text-xs">
                            {c.is_primary ? '★ ' : ''}{c.name}（{c.relation}）{c.phone}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <div className="flex flex-col gap-1.5 min-w-[9rem]">
                      <button type="button" className="btn-ghost !py-1.5 !text-xs justify-start" onClick={() => onUnlock(s.student_id)}>
                        <LockOpen className="h-3.5 w-3.5" />{locale === 'en' ? 'Unlock' : '一鍵解鎖'}
                      </button>
                      <button type="button" className="btn-ghost !py-1.5 !text-xs justify-start" onClick={() => onResetPassword(s.student_id)}>
                        <KeyRound className="h-3.5 w-3.5" />{locale === 'en' ? 'Reset pwd' : '重設密碼'}
                      </button>
                      <button type="button" className="btn-ghost !py-1.5 !text-xs justify-start" onClick={() => openEdit(s.student_id)}>
                        <Plus className="h-3.5 w-3.5" />{locale === 'en' ? 'Edit contacts' : '編輯聯絡人'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editId && (
        <div className="camp-card p-4 grid gap-3 max-w-xl">
          <h3 className="font-semibold">{locale === 'en' ? 'Edit emergency contacts' : '代為編輯緊急聯絡人'} — {editId}</h3>
          {draft.map((c, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">#{i + 1}</span>
                <button
                  type="button"
                  className="text-rose-600 text-xs inline-flex items-center gap-1"
                  onClick={() => setDraft(d => {
                    const next = d.filter((_, j) => j !== i)
                    return next.length ? next : [blank()]
                  })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input className="input-field" placeholder="姓名" value={c.name} onChange={e => setDraft(d => d.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <input className="input-field" placeholder="關係" value={c.relation} onChange={e => setDraft(d => d.map((x, j) => j === i ? { ...x, relation: e.target.value } : x))} />
              <input className="input-field" placeholder="電話" value={c.phone} onChange={e => setDraft(d => d.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} />
              <label className="text-sm inline-flex items-center gap-2">
                <input type="checkbox" checked={c.is_primary} onChange={e => setDraft(d => d.map((x, j) => ({ ...x, is_primary: j === i ? e.target.checked : false })))} />
                主要聯絡人
              </label>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setDraft(d => [...d, blank()])}><Plus className="h-4 w-4" />新增</button>
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                const cleaned = draft.filter(c => c.name.trim() || c.phone.trim())
                if (cleaned.length && !cleaned.some(c => c.is_primary)) cleaned[0].is_primary = true
                await onSaveContacts(editId, cleaned)
                setEditId(null)
              }}
            >
              <Save className="h-4 w-4" />儲存
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEditId(null)}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}
