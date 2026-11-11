import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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
import { NativeSelect } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { dbErrorKey } from '@/lib/dbErrors'
import { formatNumber, formatUzs, priceDigits } from '@/lib/money'
import { useSaveService, type ServiceItem } from './api'
import {
  DURATION_OPTIONS,
  serviceSchema,
  type ServiceFormInput,
  type ServiceFormValues,
} from './schemas'

type Props = {
  businessId: string
  /** undefined = create a new service */
  service?: ServiceItem
  nextSortOrder: number
  onClose: () => void
}

export function ServiceFormDialog({ businessId, service, nextSortOrder, onClose }: Props) {
  const { t } = useTranslation(['admin', 'errors'])
  const save = useSaveService(businessId)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormInput, unknown, ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name ?? '',
      description: service?.description ?? '',
      duration: String(service?.durationMinutes ?? 30),
      price: service ? String(service.priceUzs) : '',
      isActive: service?.isActive ?? true,
    },
  })

  // keep a current (possibly unusual) duration selectable
  const durations = [...DURATION_OPTIONS] as number[]
  if (service && !durations.includes(service.durationMinutes)) {
    durations.push(service.durationMinutes)
    durations.sort((a, b) => a - b)
  }

  const msg = (m?: string) => (m ? t(`errors:${m}` as 'errors:db.unknown') : undefined)

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await save.mutateAsync({ id: service?.id, values, nextSortOrder })
      toast.success(t(service ? 'services.updated' : 'services.created', { name: values.name }))
      onClose()
    } catch (err) {
      setFormError(t(`errors:${dbErrorKey(err)}`))
    }
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>
              {t(service ? 'services.form.editTitle' : 'services.form.createTitle')}
            </DialogTitle>
          </DialogHeader>

          <DialogBody>
            <FormField
              id="svc-name"
              label={t('services.form.name')}
              error={msg(errors.name?.message)}
            >
              <Input
                id="svc-name"
                maxLength={80}
                autoComplete="off"
                placeholder={t('services.form.namePlaceholder')}
                aria-invalid={!!errors.name}
                {...register('name')}
              />
            </FormField>

            <FormField
              id="svc-desc"
              label={`${t('services.form.description')} ${t('services.form.optional')}`}
              error={msg(errors.description?.message)}
            >
              <Textarea
                id="svc-desc"
                maxLength={300}
                rows={2}
                placeholder={t('services.form.descriptionPlaceholder')}
                aria-invalid={!!errors.description}
                {...register('description')}
              />
            </FormField>

            <div className="grid gap-4 min-[600px]:grid-cols-2">
              <FormField
                id="svc-duration"
                label={t('services.form.duration')}
                error={msg(errors.duration?.message)}
              >
                <NativeSelect id="svc-duration" {...register('duration')}>
                  {durations.map((d) => (
                    <option key={d} value={d}>
                      {t('services.form.durationOption', { count: d })}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>

              <Controller
                control={control}
                name="price"
                render={({ field }) => (
                  <FormField
                    id="svc-price"
                    label={t('services.form.price')}
                    error={msg(errors.price?.message)}
                  >
                    <Input
                      id="svc-price"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="80 000"
                      aria-invalid={!!errors.price}
                      aria-describedby="svc-price-preview"
                      // show "80 000" while storing digits "80000"
                      value={field.value ? formatNumber(Number(field.value)) : ''}
                      onChange={(e) => field.onChange(priceDigits(e.target.value))}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      className="tabular-nums"
                    />
                    <p id="svc-price-preview" className="text-[12.5px] text-muted-foreground">
                      {field.value ? formatUzs(Number(field.value)) : '—'}
                    </p>
                  </FormField>
                )}
              />
            </div>

            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <label className="flex cursor-pointer items-center gap-3.5 rounded-2xl border-[1.5px] border-border px-4 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t('services.form.active')}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {t('services.form.activeHint')}
                    </span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />

            {service && (
              <p className="rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-[13px] text-muted-foreground">
                ℹ️ {t('services.form.priceHistoryHint')}
              </p>
            )}
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
