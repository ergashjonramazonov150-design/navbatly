import { cn } from 'cn'
import { Loader2Icon, PlusIcon, SearchIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { LoadError, PageHeader } from '@/components/common/PageHeader'
import { NativeSelect } from '@/components/ui/native-select'
import {
  useAppointments,
  useSetAppointmentStatus,
  type Appointment,
  type ApptStatus,
} from '@/features/appointments/api'
import { CancelDialog } from '@/features/appointments/CancelDialog'
import { useReadyBusiness } from '@/features/business/useBusiness'
import { useSalonHours } from '@/features/calendar/api'
import { NewAppointmentDialog } from '@/features/calendar/NewAppointmentDialog'
import { useServices } from '@/features/services/api'
import { useStaffList } from '@/features/staff/api'
import { Button } from '@/components/ui/button'
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
import { formatUzs } from '@/lib/money'
import { formatLocal, toLocalDigits } from '@/lib/phone'

/*
 * Yozilishlar (M5, simplified) — approved mockup design/03-admin.html "Yozilishlar":
 * search, period + status filters, barber filter (owner), day groups, confirm / cancel.
 * "Yangi yozilish" opens the same manual-booking dialog as the calendar (M5 rest).
 */
type Period = 'today' | 'tomorrow' | 'week' | 'all'
type StatusFilter = 'all' | ApptStatus

const WD_UZ = ['', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']

export function AppointmentsPage() {
  const { t } = useTranslation(['admin', 'errors'])
  const { businessId, timezone, role, staffId: myStaffId } = useReadyBusiness()
  const staffQ = useStaffList(businessId, timezone)
  const servicesQ = useServices(businessId)
  const hoursQ = useSalonHours(businessId)
  const [creating, setCreating] = useState(false)
  const bookable = (staffQ.data ?? []).filter((s) =>
    role === 'owner' ? s.isActive : s.id === myStaffId,
  )
  const isOwner = role === 'owner'
  const list = useAppointments(businessId, timezone)
  const setStatus = useSetAppointmentStatus(businessId)
  const [period, setPeriod] = useState<Period>('today')
  const [status, setStatusFilter] = useState<StatusFilter>('all')
  const [staffFilter, setStaffFilter] = useState('all')
  const [q, setQ] = useState('')
  const [cancelling, setCancelling] = useState<Appointment | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const today = todayKey(timezone)
  // "now" = when the list was last loaded (refreshes every minute with it)
  const now = list.dataUpdatedAt
  const dayLabel = (key: string) => {
    const head =
      key === today
        ? t('appointments.period.today')
        : key === addDaysToKey(today, 1)
          ? t('appointments.period.tomorrow')
          : WD_UZ[isoWeekday(localDayStartUtc(key, timezone), timezone)]
    return `${head}, ${formatDayMonthUz(key)}`
  }

  const query = q.trim().toLowerCase()
  const qDigits = query.replace(/\D/g, '').replace(/^998/, '')
  const all = list.data ?? []
  const staffNames = [...new Map(all.map((a) => [a.staffId, a.staffName])).entries()]
  const inPeriod = (a: Appointment) => {
    const key = toDateKey(a.startsAt, timezone)
    if (period === 'today') return key === today
    if (period === 'tomorrow') return key === addDaysToKey(today, 1)
    if (period === 'week') return key >= today && key < addDaysToKey(today, 7)
    return true
  }
  // while searching, all days are searched (mockup decision)
  const base = all
    .filter((a) => staffFilter === 'all' || a.staffId === staffFilter)
    .filter((a) => (query ? true : inPeriod(a)))
    .filter(
      (a) =>
        !query ||
        a.customerName.toLowerCase().includes(query) ||
        (qDigits.length >= 2 && a.customerPhone.replace(/\D/g, '').includes(qDigits)),
    )
  const count = (s: StatusFilter) => base.filter((a) => s === 'all' || a.status === s).length
  const shown = base.filter((a) => status === 'all' || a.status === status)
  const days = [...new Set(shown.map((a) => toDateKey(a.startsAt, timezone)))]
  const pending = all.filter(
    (a) => a.status === 'pending' && (staffFilter === 'all' || a.staffId === staffFilter),
  ).length

  async function confirm(a: Appointment) {
    setBusyId(a.id)
    try {
      await setStatus.mutateAsync({ id: a.id, status: 'confirmed' })
      toast.success(t('appointments.confirmed'))
    } catch (err) {
      toast.error(t(`errors:${dbErrorKey(err)}`))
    } finally {
      setBusyId(null)
    }
  }
  async function cancel(a: Appointment, reason: string) {
    setBusyId(a.id)
    try {
      await setStatus.mutateAsync({ id: a.id, status: 'cancelled', reason })
      toast.success(t('appointments.cancelled'))
      setCancelling(null)
    } catch (err) {
      toast.error(t(`errors:${dbErrorKey(err)}`))
    } finally {
      setBusyId(null)
    }
  }

  const seg = <T extends string>(value: T, set: (v: T) => void, opts: [T, string, number?][]) => (
    <div role="group" className="flex flex-wrap gap-1.5">
      {opts.map(([v, label, n]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => set(v)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border-[1.5px] border-input px-3.5 text-[13.5px] font-semibold aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
        >
          {label}
          {n !== undefined && (
            <span className="rounded-full bg-secondary px-1.5 text-[11.5px] text-secondary-foreground">
              {n}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  const card = (a: Appointment) => {
    const past = Date.parse(a.endsAt) <= now
    const badge =
      past && a.status === 'confirmed'
        ? t('appointments.status.past')
        : t(`appointments.status.${a.status}`)
    const actionable = !(a.status === 'cancelled' || (past && a.status === 'confirmed'))
    const phone = formatLocal(toLocalDigits(a.customerPhone))
    return (
      <article
        key={a.id}
        className={cn(
          'grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2.5 rounded-2xl border-[1.5px] bg-surface px-4 py-3.5 min-[600px]:grid-cols-[auto_1fr_auto]',
          a.status === 'pending'
            ? 'border-brand/60 shadow-[inset_4px_0_0_var(--brand)]'
            : 'border-border',
          (a.status === 'cancelled' || past) && 'opacity-70',
        )}
      >
        <div className="min-w-[58px]">
          <b className="block text-[17px] tabular-nums">{formatTime(a.startsAt, timezone)}</b>
          <span className="text-[12px] text-muted-foreground tabular-nums">
            {t('appointments.until', { time: formatTime(a.endsAt, timezone) })}
          </span>
        </div>
        <div className="min-w-0">
          <div className="font-semibold">{a.customerName}</div>
          <div className="flex flex-wrap gap-x-1.5 text-[13.5px] text-muted-foreground">
            <a
              href={`tel:${a.customerPhone}`}
              className="font-semibold text-foreground underline-offset-2 hover:underline"
            >
              +998 {phone}
            </a>
            <span>·</span>
            <span>{a.serviceName}</span>
            {isOwner && (
              <>
                <span>·</span>
                <span>{a.staffName}</span>
              </>
            )}
          </div>
          {a.customerNote && <div className="mt-1 text-[13px]">💬 {a.customerNote}</div>}
          {a.status === 'cancelled' && a.cancelReason && (
            <div className="mt-1 text-[13px] text-muted-foreground">
              {t('appointments.reason', { reason: a.cancelReason })}
            </div>
          )}
        </div>
        <div className="col-span-2 flex flex-wrap items-center gap-2 min-[600px]:col-span-1 min-[600px]:flex-col min-[600px]:items-end">
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              a.status === 'pending'
                ? 'bg-brand-soft text-brand'
                : a.status === 'confirmed'
                  ? 'bg-success/15 text-success'
                  : 'bg-secondary text-muted-foreground',
            )}
          >
            {badge}
          </span>
          <span className="text-[14px] font-bold">{formatUzs(a.priceUzs)}</span>
          <span className="rounded-md bg-secondary px-2 text-[11.5px] font-semibold text-secondary-foreground">
            {t(`appointments.source.${a.source}`)}
          </span>
        </div>
        {actionable && (
          <div className="col-span-full flex flex-wrap gap-2">
            {a.status === 'pending' && (
              <button
                type="button"
                disabled={busyId === a.id}
                onClick={() => void confirm(a)}
                className="min-h-10 rounded-full bg-success px-4 text-[13.5px] font-semibold text-white disabled:opacity-50"
              >
                {busyId === a.id ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  t('appointments.confirm')
                )}
              </button>
            )}
            <button
              type="button"
              disabled={busyId === a.id}
              onClick={() => setCancelling(a)}
              className="min-h-10 rounded-full px-4 text-[13.5px] font-semibold text-destructive shadow-[inset_0_0_0_1.5px_#e7b8b3] disabled:opacity-50"
            >
              {t('appointments.cancel')}
            </button>
          </div>
        )}
      </article>
    )
  }

  return (
    <>
      <PageHeader
        title={t('appointments.title')}
        subtitle={dayLabel(today)}
        action={
          <Button
            onClick={() => setCreating(true)}
            disabled={!servicesQ.data || !staffQ.data || !hoursQ.data || bookable.length === 0}
          >
            <PlusIcon aria-hidden="true" />
            {t('newAppt.button')}
          </Button>
        }
      />
      {!isOwner && (
        <p className="mb-4 rounded-2xl border border-border bg-surface px-4 py-3 text-[14px]">
          {t('appointments.staffNotePlain')}
        </p>
      )}
      {pending > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-[#6d2f14]">
          <b className="flex-1">{t('appointments.pendingBanner', { count: pending })}</b>
          {status !== 'pending' && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('pending')
                setPeriod('all')
              }}
              className="min-h-10 rounded-full bg-foreground px-4 text-[13.5px] font-semibold text-background"
            >
              {t('appointments.show')}
            </button>
          )}
        </div>
      )}

      <div className="mb-4 grid gap-3">
        <label className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('appointments.search')}
            aria-label={t('appointments.searchLabel')}
            autoComplete="off"
            className="h-12 w-full rounded-xl border-[1.5px] border-input bg-surface pr-3.5 pl-10 text-base outline-none focus:border-foreground"
          />
        </label>
        {query ? (
          <p className="text-[13px] text-muted-foreground">{t('appointments.searchingAll')}</p>
        ) : (
          seg(period, setPeriod, [
            ['today', t('appointments.period.today')],
            ['tomorrow', t('appointments.period.tomorrow')],
            ['week', t('appointments.period.week')],
            ['all', t('appointments.period.all')],
          ])
        )}
        {seg(status, setStatusFilter, [
          ['all', t('appointments.status.all'), count('all')],
          ['pending', t('appointments.status.pending'), count('pending')],
          ['confirmed', t('appointments.status.confirmed'), count('confirmed')],
          ['cancelled', t('appointments.status.cancelledShort'), count('cancelled')],
        ])}
        {isOwner && staffNames.length > 1 && (
          <div className="max-w-xs">
            <NativeSelect
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              aria-label={t('appointments.byStaff')}
            >
              <option value="all">{t('appointments.allStaff')}</option>
              {staffNames.map(([id, n]) => (
                <option key={id} value={id}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>

      {list.isPending ? (
        <div role="status" className="flex items-center gap-3 py-10 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
          {t('account.loading')}
        </div>
      ) : list.isError ? (
        <LoadError
          text={t('appointments.loadError')}
          retryLabel={t('actions.retry')}
          onRetry={() => list.refetch()}
        />
      ) : days.length === 0 ? (
        <div className="rounded-2xl border-[1.5px] border-dashed border-input px-4 py-8 text-center text-muted-foreground">
          <b className="block text-foreground">
            {query ? t('appointments.notFound', { q: q.trim() }) : t('appointments.emptyTitle')}
          </b>
          {query ? t('appointments.notFoundText') : t('appointments.emptyText')}
        </div>
      ) : (
        <div className="grid gap-5">
          {days.map((key) => {
            const items = shown.filter((a) => toDateKey(a.startsAt, timezone) === key)
            return (
              <section key={key}>
                <h2 className="mb-2 font-heading text-[18px] font-semibold">
                  {dayLabel(key)}{' '}
                  <span className="font-sans text-[13px] font-semibold text-muted-foreground">
                    {t('appointments.dayCount', { count: items.length })}
                  </span>
                </h2>
                <div className="grid gap-2.5">{items.map(card)}</div>
              </section>
            )
          })}
        </div>
      )}

      {creating && (
        <NewAppointmentDialog
          businessId={businessId}
          timezone={timezone}
          today={today}
          services={servicesQ.data ?? []}
          staff={bookable}
          hours={hoursQ.data ?? []}
          appointments={all}
          onClose={() => setCreating(false)}
        />
      )}
      {cancelling && (
        <CancelDialog
          summary={`${cancelling.customerName} · ${dayLabel(toDateKey(cancelling.startsAt, timezone))}, ${formatTime(cancelling.startsAt, timezone)} · ${cancelling.serviceName}`}
          busy={busyId === cancelling.id}
          onConfirm={(reason) => void cancel(cancelling, reason)}
          onClose={() => setCancelling(null)}
        />
      )}
    </>
  )
}
