import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'

import { FormAlert, FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PASSWORD_RESET_ENABLED } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { authErrorKey } from './authErrors'
import { HOME_PATH } from './guards'
import { PasswordInput } from './PasswordInput'
import { loginSchema, type LoginValues } from './schemas'

export function LoginForm() {
  const { t } = useTranslation(['admin', 'errors'])
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setFormError(t(`errors:${authErrorKey(error)}`))
      return
    }
    navigate(from ?? HOME_PATH, { replace: true })
  })

  const fieldError = (msg?: string) =>
    msg ? t(`errors:${msg}` as 'errors:auth.unknown') : undefined

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormField id="email" label={t('login.email')} error={fieldError(errors.email?.message)}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('login.emailPlaceholder')}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
      </FormField>

      <FormField
        id="password"
        label={t('login.password')}
        error={fieldError(errors.password?.message)}
      >
        <PasswordInput
          id="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...register('password')}
        />
      </FormField>

      {formError && <FormAlert>{formError}</FormAlert>}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('login.submitting') : t('login.submit')}
      </Button>

      {PASSWORD_RESET_ENABLED && (
        <Link
          to="/admin/forgot-password"
          className="inline-flex min-h-11 items-center justify-self-start font-semibold text-brand hover:underline"
        >
          {t('login.forgot')}
        </Link>
      )}
    </form>
  )
}
