import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { FormAlert, FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { dbErrorKey } from '@/lib/dbErrors'
import { useSaveStaff } from './api'
import { staffSchema, type StaffFormValues } from './schemas'

/** "Yangi usta" — creates the bookable profile only. Logins are given by the platform admin. */
export function StaffFormDialog({
  businessId,
  nextSortOrder,
  onClose,
}: {
  businessId: string
  nextSortOrder: number
  onClose: () => void
}) {
  const { t } = useTranslation(['admin', 'errors'])
  const navigate = useNavigate()
  const save = useSaveStaff(businessId)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { fullName: '', bio: '' },
  })
  const msg = (m?: string) => (m ? t(`errors:${m}` as 'errors:db.unknown') : undefined)

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const created = await save.mutateAsync({ ...values, nextSortOrder })
      toast.success(t('staff.created', { name: values.fullName }))
      onClose()
      // next step for a new barber: set working hours
      navigate(`/admin/staff/${created.id}?tab=hours`)
    } catch (err) {
      setFormError(t(`errors:${dbErrorKey(err)}`))
    }
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{t('staff.form.createTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <FormField
              id="st-name"
              label={t('staff.form.name')}
              error={msg(errors.fullName?.message)}
            >
              <Input
                id="st-name"
                maxLength={80}
                autoComplete="off"
                placeholder={t('staff.form.namePlaceholder')}
                aria-invalid={!!errors.fullName}
                {...register('fullName')}
              />
            </FormField>
            <FormField
              id="st-bio"
              label={`${t('staff.form.bio')} ${t('staff.form.optional')}`}
              error={msg(errors.bio?.message)}
            >
              <Textarea
                id="st-bio"
                maxLength={300}
                rows={2}
                placeholder={t('staff.form.bioPlaceholder')}
                {...register('bio')}
              />
              <p className="text-[12.5px] text-muted-foreground">{t('staff.form.bioHint')}</p>
            </FormField>
            <p className="rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-[13px] text-muted-foreground">
              🔑 {t('staff.loginNote')}
            </p>
            {formError && <FormAlert>{formError}</FormAlert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('actions.saving') : t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
