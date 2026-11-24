/**
 * 前端記憶體中的學生工作階段。以「正規化姓名」為鍵（學號每年會變、姓名不變），
 * studentId 是「目前」的學號，只用來查報名紀錄與首次登入的預設密碼。密碼只存在記憶體，重整即消失。
 */
export interface StudentSession { name: string; studentId: string; password: string }
export const MAX_SESSIONS = 5
export const addSession = (list: StudentSession[], s: StudentSession) => list.some(x => x.name === s.name) ? list : [...list, s]
export const removeSession = (list: StudentSession[], name: string) => list.filter(x => x.name !== name)
export const updatePassword = (list: StudentSession[], name: string, password: string) => list.map(x => x.name === name ? { ...x, password } : x)
/** 移除某個工作階段後，決定接下來的作用中帳號（回傳姓名鍵） */
export const nextActiveName = (remaining: StudentSession[], activeName: string | null, removedName: string) =>
  activeName !== removedName ? activeName : (remaining[0]?.name ?? null)
