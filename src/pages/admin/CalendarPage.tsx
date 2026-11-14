import { cn } from 'cn'
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { InitialsAvatar } from '@/components/common/InitialsAvatar'
import { LoadError, PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useAppointments,
  useSetAppointmentStatus,
  type Appointment,
} from '@/features/appointments/api'
import { CancelDialog } from '@/features/appointments/CancelDialog'
import { useReadyBusiness } from '@/features/business/useBusiness'
import { useSalonHours, useSalonTimeOff } from '@/features/calendar/api'
import { NewAppointmentDialog } from '@/features/calendar/NewAppointmentDialog'
import { imageUrls } from '@/features/images/api'
import { useServices } from '@/features/services/api'
import { useStaffList } from '@/features/staff/api'
import {
  addDaysToKey,
  formatDayMonthUz,
  formatTime,
  isoWeekday,
  localDayStartUtc,
  toDateKey,
  todayKey,
} from '@/lib/datetime'
import { dbErrorKey } from '@/lib/dbErrors'
import { formatLocal, toLocalDigits } from '@/lib/phone'

/*
 * Kalendar (M5) — approved mockup design/03-admin.html: one day, barbers as columns
 * (phones: one barber at a time with a switcher), hatched = outside working hours / lunch /
 * days off, red line = now. Tap a free spot → "Yangi yozilish" at that time.
 */
const PX = 1.25 // pixels per minute (15 min = 19 px)
const WD_LONG = [
  '',
  'Dushanba',
  'Seshanba',
  'Chorshanba',
  'Payshanba',
  'Juma',
  'Shanba',
  'Yakshanba',
]
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export function CalendarPage() {
  const { t } = useTranslation(['admin', 'errors'])
  const { businessId, timezone, role, staffId: myStaffId } = useReadyBusiness()
  const isOwner = role === 'owner'
  const today = todayKey(timezone)
  const [day, setDay] = useState(today)
  const [showCancelled, setShowCancelled] = useState(false)
  const [picked, setPicked] = useState<string | null>(null) // phone: the barber shown
  const [creating, setCreating] = useState<{ staffId?: string; minutes?: number } | null>(null)
  const [open, setOpen] = useState<Appointment | null>(null)
  const [cancelling, setCancelling] = useState<Appointment | null>(null)

  const appts = useAppointments(businessId, timezone)
  const staffQ = useStaffList(businessId, timezone)
  const servicesQ = useServices(businessId)
  const hoursQ = useSalonHours(businessId)
  const offQ = useSalonTimeOff(businessId)
  const setStatus = useSetAppointmentStatus(businessId)

  const loading =
    appts.isPending || staffQ.isPending || hoursQ.isPending || offQ.isPending || servicesQ.isPending
  const failed =
    appts.isError || staffQ.isError || hoursQ.isError || offQ.isError || servicesQ.isError

  const weekday = isoWeekday(localDayStartUtc(day, timezone), timezone)
  const dayStart = Date.parse(localDayStartUtc(day, timezone))
  const dayEnd = Date.parse(localDayStartUtc(addDaysToKey(day, 1), timezone))
  const label = `${day === today ? t('calendar.today') : WD_LONG[weekday]}, ${formatDayMonthUz(day)}`

  const allStaff = staffQ.data ?? []
  const columns = isOwner
    ? allStaff.filter((s) => s.isActive)
    : allStaff.filter((s) => s.id === myStaffId)
  const shown = picked && columns.some((c) => c.id === picked) ? picked : columns[0]?.id
  const hours = hoursQ.data ?? []
  const dayAppts = (appts.data ?? []).filter(
    (a) => toDateKey(a.startsAt, timezone) === day && (showCancelled || a.status !== 'cancelled'),
  )
  const minuteOf = (iso: string) => Math.round((Date.parse(iso) - dayStart) / 60_000)

  // visible range: working hours of the shown barbers, widened for bookings outside them
  const todays = hours.filter(
    (h) => h.weekday === weekday && columns.some((c) => c.id === h.staffId),
  )
  let from = Math.min(
    9 * 60,
    ...todays.map((h) => h.start),
    ...dayAppts.map((a) => minuteOf(a.startsAt)),
  )
  let to = Math.max(
    20 * 60,
    ...todays.map((h) => h.end),
    ...dayAppts.map((a) => minuteOf(a.endsAt)),
  )
  from = Math.max(0, Math.floor(from / 60) * 60)
  to = Math.min(24 * 60, Math.ceil(to / 60) * 60)
  const height = (to - from) * PX
  const nowMin =
    day === today && appts.dataUpdatedAt
      ? Math.round((appts.dataUpdatedAt - dayStart) / 60_000) // "now" = last refresh (every minute)
      : null

  const dayOff = (staffId: string) =>
    (offQ.data ?? []).some(
      (o) =>
        (o.staffId === null || o.staffId === staffId) &&
        Date.parse(o.startsAt) < dayEnd &&
        Date.parse(o.endsAt) > dayStart,
    )

  async function confirm(a: Appointment) {
    try {
      await setStatus.mutateAsync({ id: a.id, status: 'confirmed' })
      toast.success(t('appointments.confirmed'))
      setOpen(null)
    } catch (err) {
      toast.error(t(`errors:${dbErrorKey(err)}`))
    }
  }
  async function cancel(a: Appointment, reason: string) {
    try {
      await setStatus.mutateAsync({ id: a.id, status: 'cancelled', reason })
      toast.success(t('appointments.cancelled'))
      setCancelling(null)
    } catch (err) {
      toast.error(t(`errors:${dbErrorKey(err)}`))
    }
  }

  const column = (staffId: string) => {
    const intervals = hours
      .filter((h) => h.staffId === staffId && h.weekday === weekday)
      .sort((a, b) => a.start - b.start)
    const off = dayOff(staffId)
    // hatched segments: before / between (lunch) / after the working intervals
    const gaps: { s: number; e: number; lunch: boolean }[] = []
    if (off || intervals.length === 0) gaps.push({ s: from, e: to, lunch: false })
    else {
      let cur = from
      intervals.forEach((iv, i) => {
        if (iv.start > cur) gaps.push({ s: cur, e: iv.start, lunch: i > 0 })
        cur = Math.max(cur, iv.end)
      })
      if (cur < to) gaps.push({ s: cur, e: to, lunch: false })
    }
    const items = dayAppts.filter((a) => a.staffId === staffId)
    return (
      <div
        className="relative cursor-copy border-l border-border"
        style={{ height }}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return
          const y = e.clientY - e.currentTarget.getBoundingClientRect().top
          const minutes = Math.floor((from + y / PX) / 15) * 15
          setCreating({ staffId, minutes })
        }}
      >
        {Array.from({ length: (to - from) / 60 }, (_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute inset-x-0 border-t border-border/70"
            style={{ top: i * 60 * PX }}
          />
        ))}
        {gaps.map((g, i) => (
          <div
            key={i}
            className="pointer-events-none absolute inset-x-0 grid place-items-center bg-[repeating-linear-gradient(135deg,var(--secondary)_0_6px,transparent_6px_12px)] text-[12px] font-semibold text-muted-foreground"
            style={{ top: (g.s - from) * PX, height: (g.e - g.s) * PX }}
          >
            {off ? t('calendar.dayOff') : g.lunch ? t('calendar.lunch') : ''}
          </div>
        ))}
        {items.map((a) => {
          const top = (minuteOf(a.startsAt) - from) * PX
          const h = Math.max(22, (minuteOf(a.endsAt) - minuteOf(a.startsAt)) * PX - 2)
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setOpen(a)}
              className={cn(
                'absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-left text-[12.5px] leading-tight',
                a.status === 'confirmed' && 'bg-foreground text-background',
                a.status === 'pending' &&
                  'border-[1.5px] border-brand bg-brand-soft text-[#6d2f14]',
                a.status === 'cancelled' &&
                  'border border-dashed border-input bg-surface-2 text-muted-foreground line-through',
              )}
              style={{ top, height: h }}
            >
              <b className="tabular-nums">{formatTime(a.startsAt, timezone)}</b> · {a.customerName}
              <span className="block truncate opacity-80">{a.serviceName}</span>
            </button>
          )
        })}
        {nowMin !== null && nowMin >= from && nowMin <= to && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive"
            style={{ top: (nowMin - from) * PX }}
          />
        )}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={t('calendar.title')}
        subtitle={t('calendar.hint')}
        action={
          <Button onClick={() => setCreating({})} disabled={loading || columns.length === 0}>
            <PlusIcon aria-hidden="true" />
            {t('newAppt.button')}
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDay(addDaysToKey(day, -1))}
          aria-label={t('calendar.prev')}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDay(addDaysToKey(day, 1))}
          aria-label={t('calendar.next')}
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
        <h2 className="font-heading text-[20px] font-semibold">{label}</h2>
        {day !== today && (
          <Button variant="ghost" size="sm" onClick={() => setDay(today)}>
            {t('calendar.today')}
          </Button>
        )}
        <label className="ml-auto flex items-center gap-2 text-[14px]">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
            className="size-4 accent-foreground"
          />
          {t('calendar.showCancelled')}
        </label>
      </div>
      <div className="mb-3 flex flex-wrap gap-4 text-[13px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded bg-foreground" />
          {t('calendar.legend.confirmed')}
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded border-[1.5px] border-brand bg-brand-soft" />
          {t('calendar.legend.pending')}
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded bg-[repeating-linear-gradient(135deg,var(--input)_0_3px,transparent_3px_6px)]" />
          {t('calendar.legend.off')}
        </span>
      </div>

      {loading ? (
        <div role="status" className="flex items-center gap-3 py-10 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
          {t('account.loading')}
        </div>
      ) : failed ? (
        <LoadError
          text={t('appointments.loadError')}
          retryLabel={t('actions.retry')}
          onRetry={() => void appts.refetch()}
        />
      ) : columns.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{t('calendar.noStaff')}</p>
      ) : (
        <>
          {columns.length > 1 && (
            <div
              role="group"
              aria-label={t('calendar.pickBarber')}
              className="mb-3 flex gap-1.5 overflow-x-auto min-[900px]:hidden"
            >
              {columns.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={c.id === shown}
                  onClick={() => setPicked(c.id)}
                  className="min-h-10 shrink-0 rounded-full border-[1.5px] border-input px-3.5 text-[13.5px] font-semibold aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
                >
                  {c.fullName}
                </button>
              ))}
            </div>
          )}
          <div className="overflow-x-auto rounded-2xl border-[1.5px] border-border bg-surface">
            <div className="flex min-w-full">
              <div className="w-14 shrink-0">
                <div className="h-14 border-b border-border" />
                <div className="relative" style={{ height }}>
                  {Array.from({ length: (to - from) / 60 + 1 }, (_, i) => (
                    <span
                      key={i}
                      className="absolute right-2 -translate-y-1/2 text-[12px] text-muted-foreground tabular-nums"
                      style={{ top: i * 60 * PX }}
                    >
                      {i * 60 + from < to ? hhmm(from + i * 60) : ''}
                    </span>
                  ))}
                </div>
              </div>
              {columns.map((c) => (
                <div
                  key={c.id}
                  className={cn('min-w-[180px] flex-1', c.id !== shown && 'max-[899px]:hidden')}
                >
                  <div className="flex h-14 items-center gap-2.5 border-b border-l border-border px-3">
                    <InitialsAvatar
                      name={c.fullName}
                      photoUrl={imageUrls(c.photoPath)?.sm}
                      className="size-9 text-sm"
                    />
                    <span className="min-w-0">
                      <b className="block truncate text-[14px]">{c.fullName}</b>
                      <span className="text-[12px] text-muted-foreground">
                        {t('calendar.count', {
                          count: dayAppts.filter(
                            (a) => a.staffId === c.id && a.status !== 'cancelled',
                          ).length,
                        })}
                      </span>
                    </span>
                  </div>
                  {column(c.id)}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {creating && (
        <NewAppointmentDialog
          businessId={businessId}
          timezone={timezone}
          today={today}
          services={servicesQ.data ?? []}
          staff={columns}
          hours={hours}
          appointments={appts.data ?? []}
          initial={{ staffId: creating.staffId, day, minutes: creating.minutes }}
          onClose={() => setCreating(null)}
        />
      )}

      {open && !cancelling && (
        <Dialog open onOpenChange={(o) => !o && setOpen(null)}>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{open.customerName}</DialogTitle>
            </DialogHeader>
            <DialogBody className="grid gap-1.5 text-[14.5px]">
              <p>
                <b>
                  {formatTime(open.startsAt, timezone)}–{formatTime(open.endsAt, timezone)}
                </b>{' '}
                · {open.serviceName} · {open.staffName}
              </p>
              <a
                href={`tel:${open.customerPhone}`}
                className="font-semibold underline-offset-2 hover:underline"
              >
                +998 {formatLocal(toLocalDigits(open.customerPhone))}
              </a>
              {open.customerNote && <p>💬 {open.customerNote}</p>}
              <p className="text-muted-foreground">
                {t(`appointments.status.${open.status}`)} ·{' '}
                {t(`appointments.source.${open.source}`)}
                {open.cancelReason
                  ? ` · ${t('appointments.reason', { reason: open.cancelReason })}`
                  : ''}
              </p>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(null)}>
                {t('calendar.close')}
              </Button>
              {open.status !== 'cancelled' && Date.parse(open.endsAt) > dayStart && (
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setCancelling(open)}
                >
                  {t('appointments.cancel')}
                </Button>
              )}
              {open.status === 'pending' && (
                <Button
                  variant="success"
                  disabled={setStatus.isPending}
                  onClick={() => void confirm(open)}
                >
                  {t('appointments.confirm')}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {cancelling && (
        <CancelDialog
          summary={`${cancelling.customerName} · ${label}, ${formatTime(cancelling.startsAt, timezone)} · ${cancelling.serviceName}`}
          busy={setStatus.isPending}
          onConfirm={(reason) => void cancel(cancelling, reason).then(() => setOpen(null))}
          onClose={() => setCancelling(null)}
        />
      )}
    </>
  )
}
