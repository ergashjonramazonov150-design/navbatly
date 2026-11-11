import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { FormAlert, FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { authErrorKey } from './authErrors'
import { forgotSchema, type ForgotValues } from './schemas'

type Result = { kind: 'sent'; email: string } | { kind: 'unavailable' } | null

export function ForgotPasswordForm() {
  const { t } = useTranslation(['admin', 'errors'])
  const [result, setResult] = useState<Result>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) })

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    })
    if (error) {
      const key = authErrorKey(error)
      if (key === 'auth.resetUnavailable') return setResult({ kind: 'unavailable' })
      return setFormError(t(`errors:${key}`))
    }
    // Same answer whether or not the account exists — never reveal which emails are registered.
    setResult({ kind: 'sent', email })
  })

  if (result?.kind === 'sent') {
    return (
      <div role="status" className="rounded-xl bg-success-soft px-4 py-3 text-success">
        <p className="font-semibold">{t('forgot.sentTitle')}</p>
        <p className="mt-1 text-sm">{t('forgot.sent', { email: result.email })}</p>
      </div>
    )
  }
  if (result?.kind === 'unavailable') {
    return <FormAlert>{t('errors:auth.resetUnavailable')}</FormAlert>
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormField
        id="email"
        label={t('login.email')}
        error={
          errors.email?.message && t(`errors:${errors.email.message}` as 'errors:auth.unknown')
        }
      >
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('login.emailPlaceholder')}
          aria-invalid={!!errors.email}
          {...register('email')}
        />
      </FormField>
      {formError && <FormAlert>{formError}</FormAlert>}
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('forgot.submitting') : t('forgot.submit')}
      </Button>
    </form>
  )
}
