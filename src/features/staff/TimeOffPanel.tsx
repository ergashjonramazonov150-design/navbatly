import { Loader2Icon, PlusIcon, XIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { FormField } from '@/components/common/FormField'
import { ImpactConfirmDialog } from '@/components/common/ImpactConfirmDialog'
import { LoadError } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addDaysToKey,
  formatDayMonthUz,
  localDayStartUtc,
  toDateKey,
  todayKey,
} from '@/lib/datetime'
import { dbErrorKey } from '@/lib/dbErrors'
import { countBookingsInRange, useAddTimeOff, useDeleteTimeOff, useTimeOff } from './api'
import { daysBetween, validateRange, type TimeOffError } from './timeOff'

/**
 * Days off as WHOLE local days. Stored as exact moments:
 *   starts_at = local 00:00 of the first day, ends_at = local 00:00 of the day AFTER the last.
 * staffId = null → salon-wide closed days (reused in Sozlamalar, delivery 3c).
 */
export function TimeOffPanel({
  businessId,
  staffId,
  timezone,
  title,
  hint,
}: {
  businessId: string
  staffId: string | null
  timezone: string
  title: string
  hint: string
}) {
  const { t } = useTranslation(['admin', 'errors'])
  const list = useTimeOff(businessId, staffId)
  const add = useAddTimeOff(businessId, staffId)
  const remove = useDeleteTimeOff(businessId, staffId)
  const today = todayKey(timezone)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<TimeOffError>(null)
  const [checking, setChecking] = useState(false)
  const [impact, setImpact] = useState<number | null>(null)

  const range = () => ({
    fromIso: localDayStartUtc(from, timezone),
    toIso: localDayStartUtc(addDaysToKey(to || from, 1), timezone),
  })

  const doAdd = async () => {
    try {
      await add.mutateAsync({ ...range(), reason: reason.trim() })
      toast.success(t('timeOff.added'))
      setFrom('')
      setTo('')
      setReason('')
    } catch (err) {
      toast.error(t(`errors:${dbErrorKey(err)}`))
    } finally {
      setImpact(null)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const err = validateRange(from, to || from, today)
    setError(err)
    if (err) return
    setChecking(true)
    try {
      const count = await countBookingsInRange({ businessId, staffId, ...range() })
      if (count > 0) setImpact(count)
      else await doAdd()
    } catch (err2) {
      toast.error(t(`errors:${dbErrorKey(err2)}`))
    } finally {
      setChecking(false)
    }
  }

  const labelOf = (startsAt: string, endsAt: string) => {
    const a = toDateKey(startsAt, timezone)
    const b = toDateKey(new Date(endsAt).getTime() - 1, timezone)
    const days = daysBetween(a, b)
    return {
      text: a === b ? formatDayMonthUz(a) : `${formatDayMonthUz(a)} — ${formatDayMonthUz(b)}`,
      days: days === 1 ? t('timeOff.oneDay') : t('timeOff.days', { count: days }),
    }
  }

  return (
    <section className="rounded-2xl border-[1.5px] border-border bg-surface p-4 min-[600px]:p-5">
      <h2 className="text-[19px] font-semibold">{title}</h2>
      <p className="mt-1 mb-4 text-[13.5px] text-muted-foreground">{hint}</p>

      {list.isPending ? (
        <div role="status" className="flex items-center gap-3 py-4 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
          {t('account.loading')}
        </div>
      ) : list.isError ? (
        <LoadError
          text={t('account.loadError')}
          retryLabel={t('actions.retry')}
          onRetry={() => list.refetch()}
        />
      ) : list.data.length === 0 ? (
        <p className="mb-4 rounded-xl border-[1.5px] border-dashed border-input px-4 py-5 text-center text-muted-foreground">
          {t('timeOff.empty')}
        </p>
      ) : (
        <ul className="mb-4 grid gap-2">
          {list.data.map((o) => {
            const l = labelOf(o.startsAt, o.endsAt)
            return (
              <li
                key={o.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{l.text}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {l.days}
                    {o.reason ? ` · ${o.reason}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(o.id, {
                      onSuccess: () => toast.success(t('timeOff.removed')),
                      onError: (err) => toast.error(t(`errors:${dbErrorKey(err)}`)),
                    })
                  }
                  aria-label={t('timeOff.remove', { range: l.text })}
                  className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-surface hover:text-foreground"
                >
                  <XIcon className="size-5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <form onSubmit={submit} noValidate className="grid gap-3">
        <div className="grid gap-3 min-[600px]:grid-cols-2">
          <FormField id={`to-from-${staffId ?? 'salon'}`} label={t('timeOff.from')}>
            <Input
              id={`to-from-${staffId ?? 'salon'}`}
              type="date"
              min={today}
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                if (!to || to < e.target.value) setTo(e.target.value)
              }}
              aria-invalid={error === 'fromRequired' || error === 'past'}
            />
          </FormField>
          <FormField id={`to-to-${staffId ?? 'salon'}`} label={t('timeOff.to')}>
            <Input
              id={`to-to-${staffId ?? 'salon'}`}
              type="date"
              min={from || today}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-invalid={error === 'toBeforeFrom' || error === 'tooLong'}
            />
          </FormField>
        </div>
        <FormField
          id={`to-reason-${staffId ?? 'salon'}`}
          label={`${t('timeOff.reason')} ${t('timeOff.optional')}`}
        >
          <Input
            id={`to-reason-${staffId ?? 'salon'}`}
            maxLength={200}
            value={reason}
            placeholder={t('timeOff.reasonPlaceholder')}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
        {error && (
          <p role="alert" className="text-[13px] text-destructive">
            {t(`timeOff.errors.${error}`)}
          </p>
        )}
        <div>
          <Button type="submit" disabled={checking || add.isPending}>
            <PlusIcon aria-hidden="true" />
            {checking || add.isPending ? t('actions.saving') : t('timeOff.add')}
          </Button>
        </div>
      </form>

      {impact !== null && (
        <ImpactConfirmDialog
          title={t('timeOff.impactTitle')}
          checking={false}
          count={impact}
          someText={(count) => t('timeOff.impact', { count })}
          confirmLabel={t('impact.continue')}
          busy={add.isPending}
          onConfirm={doAdd}
          onClose={() => setImpact(null)}
        />
      )}
    </section>
  )
}
