// 手足帳號切換列：一次登入多位孩子，點頂部標籤即可切換身分
import { useState } from 'react'
import { Plus, UserRound, X } from 'lucide-react'
import { useI18n } from '../../lib/I18nContext'
import Notice from './Notice'

export interface SiblingBarProps {
  /** key＝正規化姓名（學號每年會變，姓名才是穩定的鍵） */
  items: { key: string; label: string }[]
  activeKey: string | null
  maxReached: boolean
  onSwitch: (id: string) => void
  onRemove: (id: string) => void
  onAdd: (studentId: string, password: string) => Promise<{ ok: boolean; message: string }>
}

export default function SiblingBar(p: SiblingBarProps) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const [open, setOpen] = useState(false)
  const [id, setId] = useState(''), [pwd, setPwd] = useState('')
  const [msg, setMsg] = useState(''), [ok, setOk] = useState(false), [busy, setBusy] = useState(false)
  return (
    <section className="no-print rounded-2xl border border-sky-200 bg-sky-50/70 p-3" aria-label={en ? 'Sibling accounts' : '手足帳號'}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-sky-800">{en ? 'Switch child:' : '切換孩子：'}</span>
        <div role="tablist" className="flex flex-wrap gap-2">
          {p.items.map(({ key: sid, label }) => (
            <span key={sid} className={`inline-flex items-center overflow-hidden rounded-xl border text-sm font-semibold ${sid === p.activeKey ? 'border-orange-500 bg-orange-500 text-white' : 'border-sky-200 bg-white text-slate-700'}`}>
              <button type="button" role="tab" aria-selected={sid === p.activeKey} className="inline-flex items-center gap-1.5 px-3 py-1.5" onClick={() => p.onSwitch(sid)}>
                <UserRound className="h-3.5 w-3.5" aria-hidden />{label}
              </button>
              <button type="button" aria-label={en ? 'Remove' : '移除'} className="px-2 py-1.5 opacity-70 hover:opacity-100" onClick={() => p.onRemove(sid)}><X className="h-3.5 w-3.5" /></button>
            </span>
          ))}
        </div>
        {!p.maxReached && (
          <button type="button" className="btn-ghost !py-1.5 !text-xs" onClick={() => { setOpen(o => !o); setMsg('') }}>
            <Plus className="h-3.5 w-3.5" aria-hidden />{en ? 'Add sibling account' : '新增手足帳號'}
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-xs font-medium text-slate-600">{en ? 'Sibling student ID' : '手足學號（5 碼）'}
            <input className="input-field" inputMode="numeric" maxLength={5} value={id} onChange={e => setId(e.target.value.replace(/\D/g, ''))} placeholder="10101" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">{en ? 'Sibling password' : '手足的密碼'}
            <input className="input-field" type="password" value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="off" />
          </label>
          <button type="button" className="btn-primary" disabled={busy || id.length < 5 || !pwd}
            onClick={async () => {
              setBusy(true)
              const r = await p.onAdd(id, pwd)
              setBusy(false); setOk(r.ok); setMsg(r.message)
              if (r.ok) { setId(''); setPwd(''); setOpen(false) }
            }}>
            {en ? 'Verify & add' : '驗證並新增'}
          </button>
        </div>
      )}
      <div className="mt-2"><Notice msg={msg} ok={ok} onClose={() => setMsg('')} /></div>
    </section>
  )
}
