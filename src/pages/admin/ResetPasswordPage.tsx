import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { FullScreenLoader } from '@/components/common/FullScreenMessage'
import { AuthCard } from '@/features/auth/AuthCard'
import { LOGIN_PATH } from '@/features/auth/guards'
import { ResetPasswordForm } from '@/features/auth/ResetPasswordForm'
import { useAuth } from '@/features/auth/useAuth'
import { PASSWORD_RESET_ENABLED } from '@/lib/env'

/** True when Supabase redirected here with an error (expired / already used link). */
function linkHasError() {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
  return params.has('error') || params.has('error_code')
}

export function ResetPasswordPage() {
  const { t } = useTranslation('admin')
  const { state } = useAuth()

  if (state.status === 'loading') return <FullScreenLoader label={t('reset.checking')} />

  // The reset link signs the user in temporarily; without that session the link was bad.
  if (state.status === 'signedOut' || linkHasError()) {
    return (
      <AuthCard title={t('reset.invalidTitle')} subtitle={t('reset.invalid')}>
        <Link
          to={PASSWORD_RESET_ENABLED ? '/admin/forgot-password' : LOGIN_PATH}
          className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline"
        >
          {PASSWORD_RESET_ENABLED ? t('forgot.submit') : t('forgot.backToLogin')}
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t('reset.title')} subtitle={t('reset.subtitle')}>
      <ResetPasswordForm />
    </AuthCard>
  )
}
