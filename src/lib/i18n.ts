import { Locale } from '../types'

const dict = {
  'app.title': { 'zh-TW': '青山國小營隊報名系統', en: 'Qingshan Elementary School Camp Registration System' },
  'app.short': { 'zh-TW': '青山國小營隊報名', en: 'Qingshan Camp Registration' },
  'nav.front': { 'zh-TW': '學生報名首頁', en: 'Student Home' },
  'nav.contacts': { 'zh-TW': '緊急聯絡人資料', en: 'Emergency Contacts' },
  'nav.camps': { 'zh-TW': '營隊與分班管理', en: 'Camps & Classes' },
  'nav.students': { 'zh-TW': '全校學生管理', en: 'All Students' },
  'nav.settings': { 'zh-TW': '系統設定', en: 'Settings' },
  'nav.r1': { 'zh-TW': '班級簽到表', en: 'Class Attendance' },
  'nav.r2': { 'zh-TW': '總簽到表', en: 'Master Attendance' },
  'nav.r3': { 'zh-TW': '報名通知單', en: 'Enrollment Notice' },
  'nav.reports': { 'zh-TW': '行政報表', en: 'Reports' },
  'nav.print': { 'zh-TW': '列印', en: 'Print' },
  'nav.adminLogout': { 'zh-TW': '登出後台', en: 'Admin Logout' },
  'nav.summer': { 'zh-TW': '夏令營', en: 'Summer' },
  'nav.winter': { 'zh-TW': '寒令營', en: 'Winter' },
  'lang.zh': { 'zh-TW': '中文', en: '中文' },
  'lang.en': { 'zh-TW': 'English', en: 'English' },

  'pass.title': { 'zh-TW': '學生專屬通行證', en: 'Student Pass' },
  'pass.class': { 'zh-TW': '選擇班級（101~601）', en: 'Select class (101–601)' },
  'pass.student': { 'zh-TW': '選擇座號／學生姓名', en: 'Select seat / student' },
  'pass.pickStudent': { 'zh-TW': '請選擇學生', en: 'Select a student' },
  'pass.password': { 'zh-TW': '學生密碼（預設為學號 5 碼）', en: 'Password (default: 5-digit student ID)' },
  'pass.login': { 'zh-TW': '登入', en: 'Sign in' },
  'pass.logout': { 'zh-TW': '登出學生', en: 'Sign out' },
  'pass.changePwd': { 'zh-TW': '修改密碼', en: 'Change password' },
  'pass.enrolledCount': { 'zh-TW': '已報名 {n} 個營隊', en: '{n} camp(s) enrolled' },
  'pass.needLogin': { 'zh-TW': '請先選擇班級與學生並輸入密碼登入', en: 'Please select a student and sign in with password' },
  'pass.locked': { 'zh-TW': '帳號已鎖定', en: 'Account locked' },

  'window.before': { 'zh-TW': '尚未開放報名（開放時間：{t}）', en: 'Registration not open yet (opens: {t})' },
  'window.open': { 'zh-TW': '報名開放中（截止：{t}）', en: 'Registration open (deadline: {t})' },
  'window.after': { 'zh-TW': '報名已截止', en: 'Registration closed' },
  'window.unset': { 'zh-TW': '報名時段尚未設定', en: 'Registration window not set' },

  'camp.list': { 'zh-TW': '可報名營隊', en: 'Available camps' },
  'camp.mine': { 'zh-TW': '我的已報名行程', en: 'My enrollments' },
  'camp.enroll': { 'zh-TW': '報名', en: 'Enroll' },
  'camp.cancel': { 'zh-TW': '取消報名', en: 'Cancel enrollment' },
  'camp.leave': { 'zh-TW': '請假', en: 'Request leave' },
  'camp.fullCourse': { 'zh-TW': '全程參加', en: 'Full course' },
  'camp.singleDay': { 'zh-TW': '單日擇一場次 · 多日擇一參加', en: 'Single-day choice' },
  'camp.gradeAll': { 'zh-TW': '不限年級・後台分班', en: 'All grades · admin grouping' },
  'camp.gradeRange': { 'zh-TW': '限 {a}~{b} 年級', en: 'Grades {a}–{b} only' },
  'camp.capacity': { 'zh-TW': '{n} / {max}', en: '{n} / {max}' },
  'camp.plenty': { 'zh-TW': '名額充裕', en: 'Seats available' },
  'camp.low': { 'zh-TW': '即將額滿', en: 'Almost full' },
  'camp.full': { 'zh-TW': '額滿', en: 'Full' },
  'camp.hasSub': { 'zh-TW': '含分班', en: 'Has sub-classes' },
  'camp.teacher': { 'zh-TW': '講師：{t}', en: 'Teacher: {t}' },
  'camp.gradeMismatch': { 'zh-TW': '年級不符', en: 'Grade not allowed' },
  'camp.already': { 'zh-TW': '已報名', en: 'Enrolled' },
  'camp.fullBtn': { 'zh-TW': '已額滿', en: 'Full' },
  'camp.success': { 'zh-TW': '報名成功', en: 'Enrollment successful' },
  'camp.cancelled': { 'zh-TW': '已取消，名額已釋出', en: 'Cancelled; seat released' },
  'camp.needContact': {
    'zh-TW': '請先至『緊急聯絡人資料』分頁填寫完整聯絡人姓名與電話，才可進行營隊報名！',
    en: 'Please complete Emergency Contacts (name & phone) before enrolling!',
  },
  'camp.leaveBlocked': {
    'zh-TW': '單日營隊無法請假，若當天無法出席請直接『取消報名』以釋出名額',
    en: 'Single-day camps cannot request leave. Please cancel enrollment to free the seat.',
  },
  'camp.leaveSaved': { 'zh-TW': '請假已登記', en: 'Leave saved' },
  'camp.leaveReason': { 'zh-TW': '請假事由', en: 'Reason for leave' },
  'camp.leaveDates': { 'zh-TW': '請假日期', en: 'Leave dates' },
  'camp.leaveSubmit': { 'zh-TW': '送出請假', en: 'Submit leave' },
  'camp.subClass': { 'zh-TW': '分班：{n}', en: 'Class: {n}' },

  'contact.title': { 'zh-TW': '緊急聯絡人資料', en: 'Emergency Contacts' },
  'contact.hint': { 'zh-TW': '至少需填寫 1 位有效聯絡人（姓名與電話）才可報名營隊。', en: 'At least one valid contact (name & phone) is required before enrollment.' },
  'contact.name': { 'zh-TW': '聯絡人姓名', en: 'Contact name' },
  'contact.relation': { 'zh-TW': '關係', en: 'Relation' },
  'contact.phone': { 'zh-TW': '電話', en: 'Phone' },
  'contact.primary': { 'zh-TW': '主要聯絡人', en: 'Primary' },
  'contact.add': { 'zh-TW': '新增聯絡人', en: 'Add contact' },
  'contact.remove': { 'zh-TW': '移除', en: 'Remove' },
  'contact.save': { 'zh-TW': '儲存聯絡人', en: 'Save contacts' },
  'contact.saved': { 'zh-TW': '緊急聯絡人已儲存', en: 'Emergency contacts saved' },

  'admin.gate': { 'zh-TW': '後台管理驗證', en: 'Admin verification' },
  'admin.password': { 'zh-TW': '後台密碼', en: 'Admin password' },
  'admin.unlock': { 'zh-TW': '進入後台', en: 'Enter admin' },
  'admin.wrong': { 'zh-TW': '後台密碼錯誤', en: 'Incorrect admin password' },
  'admin.once': { 'zh-TW': '驗證一次後，本次瀏覽工作階段內切換後台分頁無需再次輸入。', en: 'One unlock covers all admin tabs for this browser session.' },

  'btn.save': { 'zh-TW': '儲存', en: 'Save' },
  'btn.cancel': { 'zh-TW': '取消', en: 'Cancel' },
  'btn.close': { 'zh-TW': '點擊關閉', en: 'Click to dismiss' },
  'msg.ok': { 'zh-TW': '完成', en: 'Done' },
  'msg.note': { 'zh-TW': '請留意', en: 'Please note' },
  'loading': { 'zh-TW': '載入中…', en: 'Loading…' },
  'grade.n': { 'zh-TW': '{n}年級', en: 'Grade {n}' },
  'leave.mark': { 'zh-TW': '請假', en: 'Leave' },
} as const

export type I18nKey = keyof typeof dict

export function t(key: I18nKey, locale: Locale, vars?: Record<string, string | number>): string {
  let raw: string = dict[key]?.[locale] ?? dict[key]?.['zh-TW'] ?? key
  if (!vars) return raw
  for (const [k, v] of Object.entries(vars)) {
    raw = raw.split(`{${k}}`).join(String(v))
  }
  return raw
}

export function campDisplayName(camp: { name: string; name_en?: string }, locale: Locale): string {
  if (locale === 'en' && camp.name_en?.trim()) return camp.name_en.trim()
  return camp.name
}
