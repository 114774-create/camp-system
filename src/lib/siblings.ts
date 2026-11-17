/** 前端記憶體中的學生工作階段（含密碼，只存在記憶體，重整即消失） */
export interface StudentSession { id: string; password: string }
export const MAX_SESSIONS = 5
export const addSession = (list: StudentSession[], s: StudentSession) => list.some(x => x.id === s.id) ? list : [...list, s]
export const removeSession = (list: StudentSession[], id: string) => list.filter(x => x.id !== id)
export const updatePassword = (list: StudentSession[], id: string, password: string) => list.map(x => x.id === id ? { ...x, password } : x)
/** 移除某個工作階段後，決定接下來的作用中帳號 */
export const nextActiveId = (remaining: StudentSession[], activeId: string | null, removedId: string) =>
  activeId !== removedId ? activeId : (remaining[0]?.id ?? null)
