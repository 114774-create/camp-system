import { createClient } from '@supabase/supabase-js'
import { Camp, Registration } from '../types'
import { SEED } from './seed'
export interface Repo {
  listCamps(): Promise<Camp[]>; saveCamp(c: Camp): Promise<void>; deleteCamp(id: string): Promise<void>
  listRegs(): Promise<Registration[]>; upsertRegs(r: Registration[]): Promise<void>
}
const ls = <T,>(k: string, init: T): T => { try { const x = localStorage.getItem(k); return x ? JSON.parse(x) : init } catch { return init } }
const localRepo: Repo = {
  async listCamps() { return ls('camps', SEED) },
  async saveCamp(c) { const l = ls<Camp[]>('camps', SEED); localStorage.setItem('camps', JSON.stringify(l.some(x => x.id === c.id) ? l.map(x => x.id === c.id ? c : x) : [...l, c])) },
  async deleteCamp(id) { localStorage.setItem('camps', JSON.stringify(ls<Camp[]>('camps', SEED).filter(x => x.id !== id))) },
  async listRegs() { return ls('regs', []) },
  async upsertRegs(rs) { const l = ls<Registration[]>('regs', []); const m = new Map(l.map(x => [x.id, x])); rs.forEach(r => m.set(r.id, r)); localStorage.setItem('regs', JSON.stringify([...m.values()])) },
}
const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY
const sb = url && key ? createClient(url, key) : null
const supaRepo: Repo = {
  async listCamps() { const { data, error } = await sb!.from('camps').select('data'); if (error) throw error; return data.map(d => d.data as Camp) },
  async saveCamp(c) { const { error } = await sb!.from('camps').upsert({ id: c.id, data: c }); if (error) throw error },
  async deleteCamp(id) { const { error } = await sb!.from('camps').delete().eq('id', id); if (error) throw error },
  async listRegs() { const { data, error } = await sb!.from('registrations').select('*'); if (error) throw error; return data as Registration[] },
  async upsertRegs(rs) { const { error } = await sb!.from('registrations').upsert(rs); if (error) throw error },
}
export const getRepo = (): Repo => (sb ? supaRepo : localRepo)
