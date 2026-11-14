import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { FormAlert, FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { dbErrorKey } from '@/lib/dbErrors'
import { useSaveStaff, type StaffItem } from './api'
import { staffSchema, type StaffFormValues } from './schemas'
import { StaffPhotoCard } from './StaffPhotoCard'
import { useStaffActiveToggle } from './useStaffActiveToggle'

export function ProfileTab({ staff, businessId }: { staff: StaffItem; businessId: string }) {
  const { t } = useTranslation(['admin', 'errors'])
  const save = useSaveStaff(businessId)
  const { toggle, dialog } = useStaffActiveToggle(businessId)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { fullName: staff.fullName, bio: staff.bio ?? '' },
  })
  const msg = (m?: string) => (m ? t(`errors:${m}` as 'errors:db.unknown') : undefined)

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await save.mutateAsync({ id: staff.id, ...values })
      reset(values)
      toast.success(t('actions.saved'))
    } catch (err) {
      setFormError(t(`errors:${dbErrorKey(err)}`))
    }
  })

  return (
    <div className="grid gap-4">
      <StaffPhotoCard staff={staff} businessId={businessId} />
      <section className="rounded-2xl border-[1.5px] border-border bg-surface p-4 min-[600px]:p-5">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormField
            id="pf-name"
            label={t('staff.form.name')}
            error={msg(errors.fullName?.message)}
          >
            <Input
              id="pf-name"
              maxLength={80}
              aria-invalid={!!errors.fullName}
              {...register('fullName')}
            />
          </FormField>
          <FormField
            id="pf-bio"
            label={`${t('staff.form.bio')} ${t('staff.form.optional')}`}
            error={msg(errors.bio?.message)}
          >
            <Textarea id="pf-bio" maxLength={300} rows={3} {...register('bio')} />
            <p className="text-[12.5px] text-muted-foreground">{t('staff.form.bioHint')}</p>
          </FormField>

          <p className="rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-[13px] text-muted-foreground">
            🔑 {staff.hasLogin ? t('staff.form.loginYes') : t('staff.form.loginNo')}
            <br />
            {t('staff.loginNote')}
          </p>

          {formError && <FormAlert>{formError}</FormAlert>}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
              <Switch
                checked={staff.isActive}
                onCheckedChange={(next) => toggle(staff, next)}
                aria-label={t('staff.activeLabel', { name: staff.fullName })}
              />
              {t('staff.form.active')}
            </label>
            <Button type="submit" disabled={!isDirty || isSubmitting}>
              {isSubmitting ? t('actions.saving') : t('actions.save')}
            </Button>
          </div>
        </form>
        {dialog}
      </section>
    </div>
  )
}
