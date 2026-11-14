import { useQuery } from '@tanstack/react-query'
import { cn } from 'cn'
import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import type { Appointment } from '@/features/appointments/api'
import { fetchSlots } from '@/features/booking/api'
import type { ServiceItem } from '@/features/services/api'
import type { StaffItem } from '@/features/staff/api'
import {
  addDaysToKey,
  formatDayMonthUz,
  formatTime,
  isoWeekday,
  localDayStartUtc,
} from '@/lib/datetime'
import { dbErrorKey } from '@/lib/dbErrors'
import { formatUzs } from '@/lib/money'
import { cleanLocalDigits, formatLocal, toE164 } from '@/lib/phone'
import { useCreateAppointment, type HoursRow } from './api'

const WD = ['', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']

/**
 * Manual booking (phone call / walk-in) — approved mockup 03 "Yangi yozilish".
 * Free times come from get_available_slots; "Boshqa vaqt" allows any time (warning when
 * outside working hours, error when it overlaps — the database has the final word).
 */
export function NewAppointmentDialog({
  businessId,
  timezone,
  today,
  services,
  staff,
  hours,
  appointments,
  initial,
  onClose,
}: {
  businessId: string
  timezone: string
  today: string
  services: ServiceItem[]
  staff: StaffItem[] // already limited to what this login may book for
  hours: HoursRow[]
  appointments: Appointment[]
  initial?: { staffId?: string; day?: string; minutes?: number }
  onClose: () => void
}) {
  const { t } = useTranslation(['admin', 'errors'])
  const create = useCreateAppointment(businessId)
  const active = services.filter((s) => s.isActive)
  const [serviceId, setServiceId] = useState(active[0]?.id ?? '')
  const staffFor = staff.filter((s) => s.isActive && s.serviceIds.includes(serviceId))
  const [staffId, setStaffId] = useState(initial?.staffId ?? staffFor[0]?.id ?? '')
  const effectiveStaff = staffFor.some((s) => s.id === staffId) ? staffId : (staffFor[0]?.id ?? '')
  const [day, setDay] = useState(initial?.day ?? today)
  const [slot, setSlot] = useState<string | null>(null)
  const [custom, setCustom] = useState(initial?.minutes !== undefined)
  const [customTime, setCustomTime] = useState(
    initial?.minutes !== undefined
      ? `${String(Math.floor(initial.minutes / 60)).padStart(2, '0')}:${String(initial.minutes % 60).padStart(2, '0')}`
      : '',
  )
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const service = active.find((s) => s.id === serviceId)
  const barber = staff.find((s) => s.id === effectiveStaff)
  const slots = useQuery({
    queryKey: ['slots', businessId, serviceId, effectiveStaff, day],
    enabled: !!serviceId && !!effectiveStaff,
    queryFn: () => fetchSlots(businessId, serviceId, effectiveStaff, day),
  })

  // chosen start as an exact moment
  const startIso = custom
    ? /^\d{2}:\d{2}$/.test(customTime)
      ? new Date(
          Date.parse(localDayStartUtc(day, timezone)) +
            (Number(customTime.slice(0, 2)) * 60 + Number(customTime.slice(3))) * 60_000,
        ).toISOString()
      : null
    : slot
  const startMin = startIso
    ? Number(formatTime(startIso, timezone).slice(0, 2)) * 60 +
      Number(formatTime(startIso, timezone).slice(3))
    : null
  const dur = service?.durationMinutes ?? 0
  const weekday = isoWeekday(localDayStartUtc(day, timezone), timezone)
  const clash =
    startIso &&
    appointments.some(
      (a) =>
        a.staffId === effectiveStaff &&
        a.status !== 'cancelled' &&
        Date.parse(startIso) < Date.parse(a.endsAt) &&
        Date.parse(startIso) + dur * 60_000 > Date.parse(a.startsAt),
    )
  const inHours =
    startMin !== null &&
    hours.some(
      (h) =>
        h.staffId === effectiveStaff &&
        h.weekday === weekday &&
        startMin >= h.start &&
        startMin + dur <= h.end,
    )

  const nameOk = name.trim().replace(/\s+/g, ' ').length >= 2
  const phoneOk = phone.length === 9

  async function save() {
    setTouched(true)
    setError(null)
    if (!startIso) return setError(t('newAppt.pickTime'))
    if (!nameOk || !phoneOk || !service || !effectiveStaff || clash) return
    try {
      await create.mutateAsync({
        serviceId,
        staffId: effectiveStaff,
        startsAt: startIso,
        name,
        phone: toE164(phone),
        note,
      })
      toast.success(t('newAppt.saved'))
      onClose()
    } catch (err) {
      setError(t(`errors:${dbErrorKey(err)}`))
    }
  }

  const chip =
    'min-h-10 rounded-full border-[1.5px] border-input px-3.5 text-[13.5px] font-semibold aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background'
  return (
    <Dialog open onOpenChange={(open) => !open && !create.isPending && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('newAppt.title')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3.5">
          <div className="grid gap-3 min-[600px]:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[13.5px] font-semibold">{t('newAppt.service')}</span>
              <NativeSelect
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value)
                  setSlot(null)
                }}
              >
                {active.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.durationMinutes} daq
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[13.5px] font-semibold">{t('newAppt.staff')}</span>
              <NativeSelect
                value={effectiveStaff}
                disabled={staff.length <= 1}
                onChange={(e) => {
                  setStaffId(e.target.value)
                  setSlot(null)
                }}
              >
                {staffFor.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>

          <div className="grid gap-1.5">
            <span className="text-[13.5px] font-semibold">{t('newAppt.day')}</span>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i)).map((k, i) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={k === day}
                  className={chip}
                  onClick={() => {
                    setDay(k)
                    setSlot(null)
                  }}
                >
                  {i === 0
                    ? t('calendar.today')
                    : `${WD[isoWeekday(localDayStartUtc(k, timezone), timezone)]} ${formatDayMonthUz(k).split('-')[0]}`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <span className="text-[13.5px] font-semibold">
              {t('newAppt.time')}{' '}
              <span className="font-normal text-muted-foreground">· {t('newAppt.freeTimes')}</span>
            </span>
            {slots.isPending ? (
              <Loader2Icon
                className="size-5 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            ) : slots.data?.length ? (
              <div className="grid grid-cols-4 gap-1.5 min-[600px]:grid-cols-6">
                {slots.data.map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    aria-pressed={!custom && slot === iso}
                    className={cn(chip, 'px-0 tabular-nums')}
                    onClick={() => {
                      setCustom(false)
                      setSlot(iso)
                    }}
                  >
                    {formatTime(iso, timezone)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted-foreground">
                {t('newAppt.noFree')}
              </p>
            )}
            <label className="mt-1 flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                checked={custom}
                onChange={(e) => setCustom(e.target.checked)}
                className="size-4 accent-foreground"
              />
              {t('newAppt.custom')}
            </label>
            {custom && (
              <Input
                type="time"
                step={300}
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="max-w-40 tabular-nums"
                aria-label={t('newAppt.time')}
              />
            )}
          </div>

          {startIso && barber && clash && (
            <p
              role="alert"
              className="rounded-xl border border-[#f0c4bf] bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive"
            >
              {t('newAppt.clash', { name: barber.fullName })}
            </p>
          )}
          {startIso && barber && !clash && !inHours && (
            <p className="rounded-xl border border-[#ecc9b4] bg-brand-soft px-3.5 py-2.5 text-[13px] text-[#6d2f14]">
              {t('newAppt.outside', { name: barber.fullName })}
            </p>
          )}

          <div className="grid gap-3 min-[600px]:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[13.5px] font-semibold">{t('newAppt.name')}</span>
              <Input
                value={name}
                maxLength={80}
                placeholder={t('newAppt.namePh')}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={touched && !nameOk}
              />
              {touched && !nameOk && (
                <span className="text-[12.5px] text-destructive">{t('newAppt.nameErr')}</span>
              )}
            </label>
            <label className="grid gap-1.5">
              <span className="text-[13.5px] font-semibold">{t('newAppt.phone')}</span>
              <span className="flex overflow-hidden rounded-xl border-[1.5px] border-input bg-surface">
                <span className="grid place-items-center border-r border-border px-3 font-semibold text-muted-foreground">
                  +998
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  className="h-11 min-w-0 flex-1 bg-transparent px-3 outline-none"
                  placeholder="90 123 45 67"
                  value={formatLocal(phone)}
                  onChange={(e) => setPhone(cleanLocalDigits(e.target.value))}
                  aria-invalid={touched && !phoneOk}
                />
              </span>
              {touched && !phoneOk && (
                <span className="text-[12.5px] text-destructive">{t('newAppt.phoneErr')}</span>
              )}
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-[13.5px] font-semibold">
              {t('newAppt.note')}{' '}
              <span className="font-normal text-muted-foreground">{t('newAppt.optional')}</span>
            </span>
            <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-[#f0c4bf] bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive"
            >
              {error}
            </p>
          )}
          {service && (
            <p className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted-foreground">
              {t('newAppt.hint', { price: formatUzs(service.priceUzs) })}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            {t('newAppt.cancel')}
          </Button>
          <Button onClick={() => void save()} disabled={create.isPending || !!clash}>
            {create.isPending ? t('actions.saving') : t('newAppt.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
