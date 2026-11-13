import { CopyIcon, Loader2Icon, PlusIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker } from 'react-router'
import { toast } from 'sonner'

import { ImpactConfirmDialog } from '@/components/common/ImpactConfirmDialog'
import { LoadError } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { dbErrorKey } from '@/lib/dbErrors'
import { countBookingsOutsideNewHours, useReplaceWorkingHours, useWorkingHours } from './api'
import {
  copyMondayToWorkdays,
  dayError,
  DEFAULT_DAY,
  nextInterval,
  toHHMM,
  toMinutes,
  weekHasErrors,
  WEEKDAYS,
  weeksEqual,
  type Week,
  type Weekday,
} from './hours'

export function HoursEditor({ staffId, businessId }: { staffId: string; businessId: string }) {
  const { t } = useTranslation('admin')
  const hours = useWorkingHours(staffId)
  if (hours.isPending) {
    return (
      <div role="status" className="flex items-center gap-3 py-10 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
        {t('account.loading')}
      </div>
    )
  }
  if (hours.isError) {
    return (
      <LoadError
        text={t('account.loadError')}
        retryLabel={t('actions.retry')}
        onRetry={() => hours.refetch()}
      />
    )
  }
  return <HoursForm initial={hours.data} staffId={staffId} businessId={businessId} />
}

function HoursForm({
  initial,
  staffId,
  businessId,
}: {
  initial: Week
  staffId: string
  businessId: string
}) {
  const { t } = useTranslation(['admin', 'errors'])
  const replace = useReplaceWorkingHours(staffId, businessId)
  const [baseline, setBaseline] = useState<Week>(initial) // last saved state
  const [week, setWeek] = useState<Week>(initial)
  const [saving, setSaving] = useState(false)
  const [impact, setImpact] = useState<number | null>(null)

  const dirty = !weeksEqual(week, baseline)
  const invalid = weekHasErrors(week)

  // Unsaved changes: block in-app navigation (incl. switching tabs) and page refresh/close
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  )
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const setDay = (d: Weekday, intervals: Week[Weekday]) =>
    setWeek((w) => ({ ...w, [d]: intervals }))

  const doSave = async () => {
    setSaving(true)
    try {
      await replace.mutateAsync(week)
      setBaseline(week)
      toast.success(t('hours.saved'))
    } catch (err) {
      toast.error(t(`errors:${dbErrorKey(err)}`))
    } finally {
      setSaving(false)
      setImpact(null)
    }
  }

  // Save = 1) count future bookings that would fall outside, 2) warn if any, 3) save all-or-nothing
  const save = async () => {
    setSaving(true)
    try {
      const count = await countBookingsOutsideNewHours(staffId, week)
      if (count > 0) {
        setSaving(false)
        setImpact(count)
        return
      }
      await doSave()
    } catch (err) {
      setSaving(false)
      toast.error(t(`errors:${dbErrorKey(err)}`))
    }
  }

  return (
    <section
      aria-labelledby="hours-title"
      className="rounded-2xl border-[1.5px] border-border bg-surface p-4 min-[600px]:p-5"
    >
      <h2 id="hours-title" className="text-[19px] font-semibold">
        {t('hours.title')}
      </h2>
      <p className="mt-1 mb-4 text-[13.5px] text-muted-foreground">{t('hours.hint')}</p>

      <div className="grid gap-2">
        {WEEKDAYS.map((d) => {
          const dayName = t(`weekdays.${d}`)
          const day = week[d]
          const err = dayError(day)
          return (
            <div
              key={d}
              className="grid gap-2.5 rounded-xl border border-border bg-surface-2 px-3.5 py-3 min-[600px]:grid-cols-[160px_1fr] min-[600px]:items-start"
            >
              <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
                <Switch
                  checked={day.length > 0}
                  onCheckedChange={(on) => setDay(d, on ? DEFAULT_DAY.map((i) => ({ ...i })) : [])}
                  aria-label={t('hours.worksLabel', { day: dayName })}
                />
                <span className={day.length ? '' : 'text-muted-foreground'}>{dayName}</span>
              </label>

              <div className="grid gap-2">
                {day.length === 0 ? (
                  <p className="flex min-h-11 items-center text-muted-foreground">
                    {t('hours.dayOff')}
                  </p>
                ) : (
                  day.map((iv, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <Input
                        type="time"
                        step={900}
                        value={toHHMM(iv.start)}
                        aria-label={t('hours.from', { day: dayName })}
                        aria-invalid={!!err}
                        className="h-11 w-[124px] tabular-nums"
                        onChange={(e) =>
                          e.target.value &&
                          setDay(
                            d,
                            day.map((x, k) =>
                              k === idx ? { ...x, start: toMinutes(e.target.value) } : x,
                            ),
                          )
                        }
                      />
                      <span aria-hidden="true" className="text-muted-foreground">
                        —
                      </span>
                      <Input
                        type="time"
                        step={900}
                        value={toHHMM(iv.end)}
                        aria-label={t('hours.to', { day: dayName })}
                        aria-invalid={!!err}
                        className="h-11 w-[124px] tabular-nums"
                        onChange={(e) =>
                          e.target.value &&
                          setDay(
                            d,
                            day.map((x, k) =>
                              k === idx ? { ...x, end: toMinutes(e.target.value) } : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDay(
                            d,
                            day.filter((_, k) => k !== idx),
                          )
                        }
                        aria-label={t('hours.removeInterval')}
                        className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-surface hover:text-foreground"
                      >
                        <XIcon className="size-5" />
                      </button>
                    </div>
                  ))
                )}
                {day.length > 0 && (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDay(d, [...day, nextInterval(day)])}
                    >
                      <PlusIcon aria-hidden="true" />
                      {t('hours.addInterval')}
                    </Button>
                  </div>
                )}
                {err && (
                  <p role="alert" className="text-[13px] text-destructive">
                    {t(`hours.errors.${err}`)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Button
          variant="outline"
          onClick={() => {
            setWeek(copyMondayToWorkdays(week))
            toast(t('hours.copied'))
          }}
        >
          <CopyIcon aria-hidden="true" />
          {t('hours.copyMonday')}
        </Button>
        <span className="flex-1" />
        {dirty && (
          <>
            <span className="text-[13px] font-semibold text-brand">{t('hours.unsaved')}</span>
            <Button variant="ghost" onClick={() => setWeek(baseline)} disabled={saving}>
              {t('hours.reset')}
            </Button>
          </>
        )}
        <Button onClick={save} disabled={!dirty || invalid || saving}>
          {saving ? t('actions.saving') : t('actions.save')}
        </Button>
      </div>

      {impact !== null && (
        <ImpactConfirmDialog
          title={t('hours.impactTitle')}
          checking={false}
          count={impact}
          someText={(count) => t('hours.impact', { count })}
          confirmLabel={t('impact.continue')}
          busy={saving}
          onConfirm={doSave}
          onClose={() => setImpact(null)}
        />
      )}

      {blocker.state === 'blocked' && (
        <Dialog open onOpenChange={(open) => !open && blocker.reset()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('hours.leaveTitle')}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <DialogDescription>{t('hours.leaveText')}</DialogDescription>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => blocker.reset()}>
                {t('hours.stay')}
              </Button>
              <Button variant="destructive" onClick={() => blocker.proceed()}>
                {t('hours.leave')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}
