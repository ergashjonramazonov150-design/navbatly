import { zodResolver } from '@hookform/resolvers/zod'
import { CopyIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { FormAlert, FormField } from '@/components/common/FormField'
import { useUnsavedChangesGuard } from '@/components/common/useUnsavedChangesGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { dbErrorKey } from '@/lib/dbErrors'
import { cleanLocalDigits, formatLocal, toE164, toLocalDigits, UZ_PREFIX } from '@/lib/phone'
import {
  HORIZON_OPTIONS,
  MAX_PER_PHONE_OPTIONS,
  NOTICE_OPTIONS,
  settingsSchema,
  STEP_OPTIONS,
  withCurrent,
  type SettingsFormInput,
  type SettingsFormValues,
} from './settings'
import { useSaveBusinessSettings, type BusinessSettings } from './settingsApi'

const toFormInput = (s: BusinessSettings): SettingsFormInput => ({
  name: s.name,
  phone: toLocalDigits(s.phone),
  address: s.address ?? '',
  slotStep: String(s.slotStep),
  horizonDays: String(s.horizonDays),
  noticeMinutes: String(s.noticeMinutes),
  maxPerPhone: String(s.maxPerPhone),
  autoConfirm: s.autoConfirm,
})

function Card({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border-[1.5px] border-border bg-surface p-4 min-[600px]:p-5">
      <h2 className="text-[19px] font-semibold">{title}</h2>
      <p className="mt-1 mb-4 text-[13.5px] text-muted-foreground">{hint}</p>
      {children}
    </section>
  )
}

const Hint = ({ children }: { children: ReactNode }) => (
  <p className="text-[12.5px] text-muted-foreground">{children}</p>
)

/** Salon details + booking rules, saved together with one button (approved mockup). */
export function SettingsForm({
  businessId,
  settings,
}: {
  businessId: string
  settings: BusinessSettings
}) {
  const { t } = useTranslation(['admin', 'errors'])
  const save = useSaveBusinessSettings(businessId)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SettingsFormInput, unknown, SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: toFormInput(settings),
  })
  const leaveDialog = useUnsavedChangesGuard(isDirty, t('settings.leaveText'))
  const msg = (m?: string) => (m ? t(`errors:${m}` as 'errors:db.unknown') : undefined)

  const bookingUrl = `${window.location.origin}/b/${settings.slug}`
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl)
      toast.success(t('settings.info.copied'))
    } catch {
      toast.error(t('settings.info.copyFailed'))
    }
  }

  const minutesLabel = (v: number) =>
    v === 0
      ? t('settings.units.noLimit')
      : v % 1440 === 0
        ? t('settings.units.days', { count: v / 1440 })
        : v % 60 === 0
          ? t('settings.units.hours', { count: v / 60 })
          : t('settings.units.minutes', { count: v })

  const select = (
    id: string,
    name: 'slotStep' | 'horizonDays' | 'noticeMinutes' | 'maxPerPhone',
    options: readonly number[],
    current: number,
    label: (v: number) => string,
  ) => (
    <NativeSelect id={id} {...register(name)}>
      {withCurrent(options, current).map((v) => (
        <option key={v} value={String(v)}>
          {label(v)}
        </option>
      ))}
    </NativeSelect>
  )

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await save.mutateAsync({
        name: values.name,
        phone: values.phone ? toE164(values.phone) : null,
        address: values.address || null,
        slotStep: values.slotStep,
        horizonDays: values.horizonDays,
        noticeMinutes: values.noticeMinutes,
        maxPerPhone: values.maxPerPhone,
        autoConfirm: values.autoConfirm,
      })
      // the saved values become the new "clean" state (trimmed text included)
      reset({
        ...values,
        slotStep: String(values.slotStep),
        horizonDays: String(values.horizonDays),
        noticeMinutes: String(values.noticeMinutes),
        maxPerPhone: String(values.maxPerPhone),
      })
      toast.success(t('settings.saved'))
    } catch (err) {
      setFormError(t(`errors:${dbErrorKey(err)}`))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <Card title={t('settings.info.title')} hint={t('settings.info.hint')}>
        <div className="grid gap-4">
          <FormField id="st-name" label={t('settings.info.name')} error={msg(errors.name?.message)}>
            <Input
              id="st-name"
              maxLength={100}
              aria-invalid={!!errors.name}
              {...register('name')}
            />
          </FormField>

          <FormField
            id="st-phone"
            label={`${t('settings.info.phone')} ${t('settings.info.optional')}`}
            error={msg(errors.phone?.message)}
          >
            <div className="flex gap-2">
              <span className="grid h-12 shrink-0 place-items-center rounded-xl border-[1.5px] border-input bg-surface-2 px-3 font-semibold">
                {UZ_PREFIX}
              </span>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <Input
                    id="st-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="90 123 45 67"
                    aria-invalid={!!errors.phone}
                    aria-describedby="st-phone-warning"
                    value={formatLocal(field.value)}
                    onChange={(e) => field.onChange(cleanLocalDigits(e.target.value))}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                )}
              />
            </div>
            <p id="st-phone-warning" className="text-[12.5px] text-muted-foreground">
              {t('settings.info.phoneWarning')}
            </p>
          </FormField>

          <FormField
            id="st-address"
            label={`${t('settings.info.address')} ${t('settings.info.optional')}`}
            error={msg(errors.address?.message)}
          >
            <Input id="st-address" maxLength={200} {...register('address')} />
          </FormField>

          <div className="grid gap-4 min-[700px]:grid-cols-2">
            <FormField id="st-link" label={t('settings.info.link')}>
              <div className="flex gap-2">
                <Input id="st-link" readOnly value={bookingUrl} className="bg-surface-2" />
                <Button
                  type="button"
                  variant="outline"
                  className="size-12 shrink-0"
                  onClick={copyLink}
                  aria-label={t('settings.info.copy')}
                >
                  <CopyIcon aria-hidden="true" />
                </Button>
              </div>
              <Hint>
                {t('settings.info.linkNote')} {t('settings.info.linkSoon')}
              </Hint>
            </FormField>
            <FormField id="st-tz" label={t('settings.info.timezone')}>
              <Input
                id="st-tz"
                readOnly
                className="bg-surface-2"
                value={
                  settings.timezone === 'Asia/Tashkent'
                    ? t('settings.info.timezoneTashkent')
                    : settings.timezone
                }
              />
              <Hint>{t('settings.info.timezoneNote')}</Hint>
            </FormField>
          </div>
        </div>
      </Card>

      <Card title={t('settings.rules.title')} hint={t('settings.rules.hint')}>
        <div className="grid gap-4 min-[700px]:grid-cols-2">
          <FormField id="st-step" label={t('settings.rules.step')}>
            {select('st-step', 'slotStep', STEP_OPTIONS, settings.slotStep, (v) =>
              t('settings.units.minutes', { count: v }),
            )}
            <Hint>{t('settings.rules.stepHint')}</Hint>
          </FormField>
          <FormField id="st-horizon" label={t('settings.rules.horizon')}>
            {select('st-horizon', 'horizonDays', HORIZON_OPTIONS, settings.horizonDays, (v) =>
              t('settings.units.days', { count: v }),
            )}
          </FormField>
          <FormField id="st-notice" label={t('settings.rules.notice')}>
            {select(
              'st-notice',
              'noticeMinutes',
              NOTICE_OPTIONS,
              settings.noticeMinutes,
              minutesLabel,
            )}
            <Hint>{t('settings.rules.noticeHint')}</Hint>
          </FormField>
          <FormField id="st-max" label={t('settings.rules.maxPerPhone')}>
            {select('st-max', 'maxPerPhone', MAX_PER_PHONE_OPTIONS, settings.maxPerPhone, (v) =>
              t('settings.units.bookings', { count: v }),
            )}
            <Hint>{t('settings.rules.maxPerPhoneHint')}</Hint>
          </FormField>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-2 px-3.5 py-3">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t('settings.rules.autoConfirm')}</span>
            <span className="block text-[13px] text-muted-foreground">
              {t('settings.rules.autoConfirmHint')}
            </span>
            <span className="mt-1 block text-[13px] font-semibold text-brand">
              {t('settings.rules.autoConfirmNote')}
            </span>
          </span>
          <Controller
            control={control}
            name="autoConfirm"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-label={t('settings.rules.autoConfirm')}
                className="mt-1"
              />
            )}
          />
        </label>
      </Card>

      {formError && <FormAlert>{formError}</FormAlert>}

      <div className="flex flex-wrap items-center justify-end gap-2.5">
        {isDirty && (
          <>
            <span className="text-[13px] font-semibold text-brand">{t('settings.unsaved')}</span>
            <Button type="button" variant="ghost" onClick={() => reset()} disabled={isSubmitting}>
              {t('settings.reset')}
            </Button>
          </>
        )}
        <Button type="submit" disabled={!isDirty || isSubmitting} className="min-h-12 px-7">
          {isSubmitting ? t('actions.saving') : t('settings.save')}
        </Button>
      </div>

      {leaveDialog}
    </form>
  )
}
