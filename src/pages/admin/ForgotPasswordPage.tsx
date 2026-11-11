import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { AuthCard } from '@/features/auth/AuthCard'
import { ForgotPasswordForm } from '@/features/auth/ForgotPasswordForm'
import { LOGIN_PATH } from '@/features/auth/guards'
import { PASSWORD_RESET_ENABLED } from '@/lib/env'

export function ForgotPasswordPage() {
  const { t } = useTranslation('admin')
  const back = (
    <Link
      to={LOGIN_PATH}
      className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline"
    >
      {t('forgot.backToLogin')}
    </Link>
  )

  // Switched off until custom SMTP exists (M9): explain instead of failing silently.
  if (!PASSWORD_RESET_ENABLED) {
    return (
      <AuthCard title={t('forgot.unavailableTitle')} subtitle={t('forgot.unavailable')}>
        {back}
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t('forgot.title')} subtitle={t('forgot.subtitle')} footer={back}>
      <ForgotPasswordForm />
    </AuthCard>
  )
}
