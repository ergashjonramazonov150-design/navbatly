import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { FormAlert, FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { authErrorKey } from './authErrors'
import { HOME_PATH } from './guards'
import { PasswordInput } from './PasswordInput'
import { resetSchema, type ResetValues } from './schemas'

/** Shown after the reset link created a (temporary) session. */
export function ResetPasswordForm() {
  const { t } = useTranslation(['admin', 'errors'])
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) })

  const msg = (m?: string) => (m ? t(`errors:${m}` as 'errors:auth.unknown') : undefined)

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return setFormError(t(`errors:${authErrorKey(error)}`))
    toast.success(t('reset.success'))
    navigate(HOME_PATH, { replace: true })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormField id="password" label={t('reset.password')} error={msg(errors.password?.message)}>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
      </FormField>
      <FormField id="confirm" label={t('reset.confirm')} error={msg(errors.confirm?.message)}>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm}
          {...register('confirm')}
        />
      </FormField>
      {formError && <FormAlert>{formError}</FormAlert>}
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('reset.submitting') : t('reset.submit')}
      </Button>
    </form>
  )
}
