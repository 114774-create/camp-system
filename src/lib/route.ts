export type Route = { name: 'teacher'; campId: string } | null
/** 極簡路由：/teacher-rollcall/:camp_id（不引入 react-router） */
export function parseRoute(pathname: string): Route {
  const m = pathname.match(/\/teacher-rollcall\/([^/?#]+)\/?$/)
  return m ? { name: 'teacher', campId: decodeURIComponent(m[1]) } : null
}
export const teacherLink = (campId: string, origin = typeof location !== 'undefined' ? location.origin : '') =>
  `${origin}/teacher-rollcall/${encodeURIComponent(campId)}`
