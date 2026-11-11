import { useTranslation } from 'react-i18next'

import { AuthCard } from '@/features/auth/AuthCard'
import { LoginForm } from '@/features/auth/LoginForm'

export function LoginPage() {
  const { t } = useTranslation('admin')
  return (
    <AuthCard title={t('login.title')} subtitle={t('login.subtitle')} footer={t('login.noSignup')}>
      <LoginForm />
    </AuthCard>
  )
}
