// 分頁 B：個人資料與設定（緊急聯絡人 + 修改密碼，同一畫面完成）
import { EmergencyContact, Student, StudentLoginResult, StudentProfileView } from '../../types'
import { useI18n } from '../../lib/I18nContext'
import ContactsPage from './ContactsPage'
import PasswordForm from './PasswordForm'
export interface ProfilePageProps {
  student: Student
  profile: StudentProfileView
  sessionPassword: string
  onSaveContacts: (contacts: EmergencyContact[], currentPassword: string) => Promise<StudentLoginResult>
  onChangePassword: (studentId: string, currentPassword: string, next: string) => Promise<StudentLoginResult>
}
export default function ProfilePage(p: ProfilePageProps) {
  const { t } = useI18n()
  return (
    <div className="grid max-w-2xl gap-5">
      <h2 className="section-title">{t('profile.title')}</h2>
      <ContactsPage student={p.student} profile={p.profile} sessionPassword={p.sessionPassword} onSave={p.onSaveContacts} />
      <PasswordForm studentId={p.student.student_id} onChangePassword={p.onChangePassword} />
    </div>
  )
}
