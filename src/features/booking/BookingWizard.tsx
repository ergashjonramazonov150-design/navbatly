import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from 'cn'
import {
  CheckIcon,
  ChevronLeftIcon,
  Loader2Icon,
  PhoneIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { imageUrls } from '@/features/images/api'
import {
  addDaysToKey,
  formatDayMonthUz,
  formatTime,
  isoWeekday,
  localDayStartUtc,
  todayKey,
} from '@/lib/datetime'
import { TURNSTILE_SITE_KEY } from '@/lib/env'
import { formatUzs } from '@/lib/money'
import { cleanLocalDigits, formatLocal, toE164 } from '@/lib/phone'
import { BRAND, type TelegramWebApp } from '@/lib/telegramWebApp'
import { createBooking, fetchSlots, slotsKey, type PublicSalon } from './api'
import { Turnstile } from './Turnstile'

/*
 * Public booking wizard — approved mockup design/02-booking-flow.html (v3, with photos).
 * 4 steps + success. EVERY step is a browser-history entry: the phone's Back button goes to
 * the previous step; after success Back starts a new booking (no double submit).
 * Not in this MVP: salon opening hours line (visitors can't read working hours; free times
 * come from get_available_slots), "Istalgan usta" (Phase 2, shown disabled).
 * Captcha (M7): Turnstile on the web when VITE_TURNSTILE_SITE_KEY is set; never in Telegram.
 */

type Step = 1 | 2 | 3 | 4 | 5
const NEAREST_DAYS = 7
const MAX_DATES = 30

export function BookingWizard({
  salon,
  tg = null,
}: {
  salon: PublicSalon
  /** set when the page runs inside Telegram as a Mini App */
  tg?: TelegramWebApp | null
}) {
  const { t } = useTranslation('booking')
  const qc = useQueryClient()
  const tz = salon.timezone
  const today = todayKey(tz)

  const [step, setStep] = useState<Step>(1)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [staffId, setStaffId] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const tgUser = tg?.initDataUnsafe.user
  const [name, setName] = useState(() =>
    [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ').slice(0, 80),
  )
  const [phone, setPhone] = useState('') // 9 digits
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('') // honeypot
  // web captcha (M7): only outside Telegram and only when a site key is configured
  const useCaptcha = !tg && !!TURNSTILE_SITE_KEY
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [taken, setTaken] = useState<string | null>(null) // the lost time
  const [result, setResult] = useState<{ status: 'pending' | 'confirmed' } | null>(null)
  const [photo, setPhoto] = useState<number | null>(null)

  const service = salon.services.find((s) => s.id === serviceId) ?? null
  const staff = salon.staff.find((s) => s.id === staffId) ?? null
  const staffForService = salon.staff.filter((s) => serviceId && s.serviceIds.includes(serviceId))

  /* ------------------------------ history ------------------------------ */
  const live = useRef({ step, photo, taken, serviceId, staffId, time })
  live.current = { step, photo, taken, serviceId, staffId, time }
  useEffect(() => {
    history.replaceState({ step: 1 }, '')
    const onPop = (e: PopStateEvent) => {
      const s = live.current
      if (s.photo !== null) return setPhoto(null) // Back closes the photo only
      setTaken(null)
      if (s.step === 5) {
        resetFlow()
        history.replaceState({ step: 1 }, '')
        return setStep(1)
      }
      const target = ((e.state as { step?: Step } | null)?.step ?? 1) as Step
      const reachable = !s.serviceId ? 1 : !s.staffId ? 2 : !s.time ? 3 : 4
      if (target > reachable) return history.back()
      setStep(target)
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = (n: Step) => {
    setStep(n)
    history.pushState({ step: n }, '')
    window.scrollTo(0, 0)
  }
  function resetFlow() {
    setServiceId(null)
    setStaffId(null)
    setDay(null)
    setTime(null)
    setNote('')
    setTouched(false)
    setError(null)
    setResult(null)
  }

  /* ------------------------------ data ------------------------------ */
  // "Eng yaqin: bugun 17:45" per barber — first free time in the next 7 days
  const nearest = useQueries({
    queries: staffForService.map((st) => ({
      queryKey: ['nearest', salon.id, serviceId, st.id, today],
      enabled: step >= 2 && !!serviceId,
      staleTime: 60_000,
      queryFn: async () => {
        for (let i = 0; i < NEAREST_DAYS; i++) {
          const key = addDaysToKey(today, i)
          const slots = await fetchSlots(salon.id, serviceId!, st.id, key)
          if (slots.length) return { day: key, time: slots[0] }
        }
        return null
      },
    })),
  })
  const nearestFor = (id: string) => nearest[staffForService.findIndex((s) => s.id === id)]?.data

  const dates = useMemo(
    () =>
      Array.from({ length: Math.min(salon.horizonDays, MAX_DATES) }, (_, i) => {
        const key = addDaysToKey(today, i)
        return { key, i, wd: isoWeekday(localDayStartUtc(key, tz), tz), num: Number(key.slice(8)) }
      }),
    [salon.horizonDays, today, tz],
  )

  const slots = useQuery({
    queryKey: slotsKey(salon.id, serviceId ?? '', staffId ?? '', day ?? ''),
    enabled: !!serviceId && !!staffId && !!day && step >= 3,
    queryFn: () => fetchSlots(salon.id, serviceId!, staffId!, day!),
  })

  /* ------------------------------ labels ------------------------------ */
  const dayLabel = (key: string) => {
    const i = dates.findIndex((d) => d.key === key)
    const head =
      i === 0
        ? t('dayToday')
        : i === 1
          ? t('dayTomorrow')
          : t(`wdLong.${isoWeekday(localDayStartUtc(key, tz), tz)}` as 'wdLong.1')
    return `${head}, ${formatDayMonthUz(key)}`
  }
  const whenShort = (key: string, iso: string) =>
    `${key === today ? t('today') : key === addDaysToKey(today, 1) ? t('tomorrow') : formatDayMonthUz(key)} ${formatTime(iso, tz)}`
  const minutes = (n: number) => t('minutes', { count: n })

  /* ------------------------------ actions ------------------------------ */
  const nameOk = name.trim().replace(/\s+/g, ' ').length >= 2
  const phoneOk = phone.length === 9

  function next() {
    if (step === 2 && staffId && !day) setDay(nearestFor(staffId)?.day ?? today)
    if (step < 4) return go((step + 1) as Step)
    void submit()
  }

  async function submit() {
    setTouched(true)
    setError(null)
    if (!nameOk || !phoneOk || !consent || !service || !staff || !time) return
    if (useCaptcha && !captcha) return setError(t('captchaNeeded'))
    setSubmitting(true)
    const res = await createBooking({
      businessId: salon.id,
      serviceId: service.id,
      staffId: staff.id,
      startsAt: time,
      name: name.trim(),
      phone: toE164(phone),
      note,
      website,
      tgInitData: tg?.initData,
      captchaToken: useCaptcha ? (captcha ?? undefined) : undefined,
    })
    setSubmitting(false)
    if (useCaptcha) setCaptchaReset((n) => n + 1) // a token works once
    if (res.ok) {
      setResult({ status: res.appointment.status })
      void qc.invalidateQueries({ queryKey: ['slots'] })
      void qc.invalidateQueries({ queryKey: ['nearest'] })
      return go(5)
    }
    if (res.code === 'SLOT_TAKEN' || res.code === 'SLOT_NOT_AVAILABLE') {
      setTaken(time)
      setTime(null)
      void qc.invalidateQueries({ queryKey: slotsKey(salon.id, service.id, staff.id, day ?? '') })
      return
    }
    setError(t(`errors.${res.code}` as 'errors.unknown', { defaultValue: t('errors.unknown') }))
  }

  /* ------------------------------ views ------------------------------ */
  const cover = imageUrls(salon.coverPath)
  const logo = imageUrls(salon.logoPath)
  const compact = step !== 1

  const header = (
    <header className="px-4 pt-3.5 pb-2.5">
      {!compact && cover && (
        <img
          src={cover.lg}
          srcSet={`${cover.sm} 800w, ${cover.lg} 1600w`}
          sizes="(max-width: 480px) 100vw, 480px"
          alt=""
          fetchPriority="high"
          className="-mx-4 -mt-3.5 aspect-[3/1] w-[calc(100%+2rem)] max-w-none bg-secondary object-cover"
        />
      )}
      <div className={cn('flex gap-3', !compact && cover ? 'mt-2.5 items-start' : 'items-center')}>
        {logo ? (
          <img
            src={compact ? logo.sm : logo.lg}
            alt=""
            className={cn(
              'shrink-0 border border-border bg-surface object-contain',
              compact ? 'size-9 rounded-[11px]' : 'size-[60px] rounded-[18px]',
              !compact && cover && '-mt-[38px] shadow-[0_0_0_3px_var(--background)]',
            )}
          />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              'grid shrink-0 place-items-center bg-brand font-heading font-bold text-white',
              compact ? 'size-9 rounded-[11px] text-[17px]' : 'size-11 rounded-[14px] text-xl',
            )}
          >
            {salon.name.trim()[0]?.toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[15.5px] leading-tight font-bold">{salon.name}</p>
          {!compact && salon.address && (
            <p className="truncate text-[12.5px] text-muted-foreground">{salon.address}</p>
          )}
        </div>
        {salon.phone && (
          <a
            href={`tel:${salon.phone}`}
            aria-label={t('call')}
            className={cn(
              'grid shrink-0 place-items-center rounded-full border-[1.5px] border-input',
              compact ? 'size-10' : 'size-11',
            )}
          >
            <PhoneIcon className="size-5" aria-hidden="true" />
          </a>
        )}
      </div>
      {step <= 4 && (
        <>
          <div className="mt-4 flex items-center gap-2.5">
            {step > 1 && (
              <button
                type="button"
                onClick={() => history.back()}
                aria-label={t('back')}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-surface shadow-[inset_0_0_0_1.5px_var(--border)]"
              >
                <ChevronLeftIcon className="size-5" aria-hidden="true" />
              </button>
            )}
            <div className="flex flex-1 gap-1.5" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <i
                  key={n}
                  className={cn('h-[5px] flex-1 rounded', n <= step ? 'bg-brand' : 'bg-border')}
                />
              ))}
            </div>
            <div
              role="group"
              aria-label="Til / Язык"
              className="inline-flex shrink-0 rounded-full bg-surface p-[3px] shadow-[inset_0_0_0_1.5px_var(--border)]"
            >
              <span className="grid min-h-[34px] min-w-10 place-items-center rounded-full bg-foreground text-[12.5px] font-bold text-background">
                UZ
              </span>
              <span
                title={t('ruSoon')}
                className="grid min-h-[34px] min-w-10 place-items-center text-[12.5px] font-bold text-muted-foreground/60"
              >
                RU
              </span>
            </div>
          </div>
          <p className="mt-3 text-[12.5px] font-semibold text-muted-foreground">
            {t('stepLabel', { n: step })}
          </p>
          <h1 className="mt-0.5 font-heading text-[26px] leading-tight font-semibold tracking-tight">
            {t(`titles.${(['service', 'staff', 'time', 'contact'] as const)[step - 1]}`)}
          </h1>
        </>
      )}
    </header>
  )

  const card = (pressed: boolean) =>
    cn(
      'flex w-full items-center gap-3.5 rounded-2xl border-[1.5px] px-4 py-3.5 text-left transition-colors min-h-[78px]',
      pressed
        ? 'border-foreground bg-foreground text-background'
        : 'border-border bg-surface hover:border-input',
    )
  const check = (pressed: boolean) => (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-[26px] shrink-0 place-items-center rounded-full border-2',
        pressed ? 'border-brand bg-brand text-white' : 'border-input',
      )}
    >
      {pressed && <CheckIcon className="size-4" strokeWidth={3} />}
    </span>
  )
  const pill = (text: string, tone: 'plain' | 'free' | 'soon', pressed = false) => (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
        pressed
          ? 'bg-white/15 text-background'
          : tone === 'free'
            ? 'bg-success/15 text-success'
            : tone === 'soon'
              ? 'bg-brand-soft text-brand'
              : 'bg-secondary text-secondary-foreground',
      )}
    >
      {text}
    </span>
  )

  const viewService = (
    <>
      <ul className="grid gap-2.5">
        {salon.services.map((s) => {
          const on = s.id === serviceId
          const img = imageUrls(s.photoPath)
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={on}
                className={card(on)}
                onClick={() => {
                  if (s.id !== serviceId) {
                    setStaffId(null)
                    setDay(null)
                    setTime(null)
                  }
                  setServiceId(s.id)
                }}
              >
                {img && (
                  <img
                    src={img.sm}
                    alt=""
                    loading="lazy"
                    className={cn(
                      'size-[52px] shrink-0 rounded-xl bg-secondary object-cover',
                      on && 'ring-2 ring-brand',
                    )}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[16.5px] leading-tight font-semibold">{s.name}</span>
                  {s.description && (
                    <span
                      className={cn(
                        'mt-0.5 block text-[13.5px]',
                        on ? 'text-background/75' : 'text-muted-foreground',
                      )}
                    >
                      {s.description}
                    </span>
                  )}
                  <span className="mt-1.5 flex">
                    {pill(minutes(s.durationMinutes), 'plain', on)}
                  </span>
                </span>
                <span className="text-base font-bold whitespace-nowrap">
                  {formatUzs(s.priceUzs)}
                </span>
                {check(on)}
              </button>
            </li>
          )
        })}
      </ul>
      {salon.gallery.length > 0 && (
        <section className="mt-6" aria-labelledby="works-title">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 id="works-title" className="font-heading text-[19px] font-semibold">
              {t('works')}
            </h2>
            <span className="text-[12.5px] font-semibold text-muted-foreground">
              {t('worksCount', { count: salon.gallery.length })}
            </span>
          </div>
          <div className="-mx-4 grid snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] auto-cols-[112px] grid-flow-col gap-2 overflow-x-auto px-4 pb-1.5">
            {salon.gallery.map((g, i) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  history.pushState({ step, photo: true }, '')
                  setPhoto(i)
                }}
                aria-label={t('zoom', { n: i + 1 })}
                className="size-28 snap-start overflow-hidden rounded-[14px] bg-secondary"
              >
                <img
                  src={imageUrls(g.path)?.sm}
                  alt={t('workAlt', { n: i + 1 })}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )

  const viewStaff = (
    <ul className="grid gap-2.5">
      <li>
        <div
          aria-disabled="true"
          className="flex min-h-[78px] items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed border-input px-4 py-3.5 opacity-70"
        >
          <span className="grid size-[54px] shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
            <SparklesIcon className="size-6" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16.5px] font-semibold">{t('anyBarber')}</span>
            <span className="block text-[13.5px] text-muted-foreground">{t('anyBarberSub')}</span>
            <span className="mt-1.5 flex">{pill(t('soon'), 'soon')}</span>
          </span>
        </div>
      </li>
      {staffForService.length === 0 && (
        <li className="py-6 text-center text-muted-foreground">{t('noStaff')}</li>
      )}
      {staffForService.map((st) => {
        const on = st.id === staffId
        const img = imageUrls(st.photoPath)
        const nf = nearestFor(st.id)
        return (
          <li key={st.id}>
            <button
              type="button"
              aria-pressed={on}
              className={card(on)}
              onClick={() => {
                if (st.id !== staffId) {
                  setDay(null)
                  setTime(null)
                }
                setStaffId(st.id)
              }}
            >
              {img ? (
                <img
                  src={img.sm}
                  alt=""
                  loading="lazy"
                  className={cn(
                    'size-[54px] shrink-0 rounded-full bg-secondary object-cover',
                    on && 'ring-[3px] ring-brand',
                  )}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-[54px] shrink-0 place-items-center rounded-full font-heading text-[21px] font-bold',
                    on ? 'bg-brand text-white' : 'bg-[#e9d8c4] text-[#7a3d1e]',
                  )}
                >
                  {st.fullName[0]}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[16.5px] font-semibold">{st.fullName}</span>
                {st.bio && (
                  <span
                    className={cn(
                      'block text-[13.5px]',
                      on ? 'text-background/75' : 'text-muted-foreground',
                    )}
                  >
                    {st.bio}
                  </span>
                )}
                <span className="mt-1.5 flex">
                  {nf === undefined ? (
                    <Loader2Icon className="size-4 animate-spin opacity-60" aria-hidden="true" />
                  ) : nf ? (
                    pill(t('nearest', { when: whenShort(nf.day, nf.time) }), 'free', on)
                  ) : (
                    pill(t('noFree'), 'plain', on)
                  )}
                </span>
              </span>
              {check(on)}
            </button>
          </li>
        )
      })}
    </ul>
  )

  const groups = [
    ['morning', (h: number) => h < 12],
    ['day', (h: number) => h >= 12 && h < 17],
    ['evening', (h: number) => h >= 17],
  ] as const
  const slotButton = (iso: string, pressed: boolean, onClick: () => void) => (
    <button
      key={iso}
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'min-h-12 rounded-xl border-[1.5px] text-[16px] font-semibold tabular-nums',
        pressed
          ? 'border-foreground bg-foreground text-background shadow-[0_0_0_3px_var(--brand-soft)]'
          : 'border-border bg-surface',
      )}
    >
      {formatTime(iso, tz)}
    </button>
  )

  const viewTime = (
    <>
      <div className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-2">
        {dates.map((d) => {
          const on = d.key === day
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              aria-label={dayLabel(d.key)}
              onClick={() => {
                setDay(d.key)
                setTime(null)
              }}
              className={cn(
                'grid min-w-[60px] shrink-0 place-items-center rounded-2xl border-[1.5px] px-2 py-2.5',
                on ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface',
              )}
            >
              <small className="text-[12px] font-semibold uppercase opacity-80">
                {d.i === 0 ? t('dayToday') : t(`wd.${d.wd}` as 'wd.1')}
              </small>
              <b className="font-heading text-[22px] leading-tight">{d.num}</b>
            </button>
          )
        })}
      </div>
      {slots.isPending ? (
        <p role="status" className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" /> {t('loadingSlots')}
        </p>
      ) : slots.isError ? (
        <p role="alert" className="py-6 text-destructive">
          {t('loadError')}
        </p>
      ) : slots.data.length === 0 ? (
        <div className="mt-4 rounded-2xl border-[1.5px] border-dashed border-input px-4 py-6 text-center text-muted-foreground">
          <b className="block text-foreground">{t('emptyDay')}</b>
          {t('emptyDayHint')}
        </div>
      ) : (
        groups.map(([key, fn]) => {
          const g = slots.data.filter((iso) => fn(Number(formatTime(iso, tz).slice(0, 2))))
          if (!g.length) return null
          return (
            <section key={key} className="mt-4">
              <div className="mb-2 flex justify-between text-[13px] font-semibold text-muted-foreground">
                <span>{t(`groups.${key}`)}</span>
                <span>{t('groups.free', { count: g.length })}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {g.map((iso) => slotButton(iso, iso === time, () => setTime(iso)))}
              </div>
            </section>
          )
        })
      )}
    </>
  )

  const summary = (withEdit: boolean) =>
    service &&
    staff &&
    time && (
      <div className="rounded-2xl border-[1.5px] border-border bg-surface px-4 py-2">
        {(
          [
            [t('rows.service'), `${service.name} · ${minutes(service.durationMinutes)}`, 1],
            [t('rows.staff'), staff.fullName, 2],
            [
              t('rows.time'),
              `${dayLabel(day!)}, ${formatTime(time, tz)}–${formatTime(new Date(Date.parse(time) + service.durationMinutes * 60_000), tz)}`,
              3,
            ],
          ] as const
        ).map(([k, v, s]) => (
          <div
            key={k}
            className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] text-muted-foreground">{k}</div>
              <div className="font-semibold">{v}</div>
            </div>
            {withEdit && (
              <button
                type="button"
                onClick={() => go(s as Step)}
                className="min-h-11 px-2 text-[14px] font-semibold text-brand"
              >
                {t('rows.change')}
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-border py-2.5">
          <span className="text-muted-foreground">{t('rows.price')}</span>
          <b className="text-[17px]">{formatUzs(service.priceUzs)}</b>
        </div>
      </div>
    )

  const field =
    'w-full rounded-xl border-[1.5px] bg-surface px-3.5 text-base outline-none focus:border-foreground'
  const viewContact = (
    <div className="grid gap-4">
      {summary(true)}
      <label className="grid gap-1.5">
        <span className="text-[14px] font-semibold">{t('form.name')}</span>
        <input
          className={cn(field, 'h-12', touched && !nameOk ? 'border-destructive' : 'border-input')}
          autoComplete="given-name"
          value={name}
          maxLength={80}
          placeholder={t('form.namePh')}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={touched && !nameOk}
        />
        {touched && !nameOk && (
          <span className="text-[13px] text-destructive">{t('form.nameErr')}</span>
        )}
      </label>
      <label className="grid gap-1.5">
        <span className="text-[14px] font-semibold">{t('form.phone')}</span>
        <span
          className={cn(
            'flex overflow-hidden rounded-xl border-[1.5px] bg-surface',
            touched && !phoneOk ? 'border-destructive' : 'border-input',
          )}
        >
          <span className="grid place-items-center border-r border-border px-3 font-semibold text-muted-foreground">
            +998
          </span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
            placeholder="90 123 45 67"
            value={formatLocal(phone)}
            onChange={(e) => {
              let d = e.target.value.replace(/\D/g, '')
              if (d.length > 9 && d.startsWith('998')) d = d.slice(3)
              setPhone(cleanLocalDigits(d))
            }}
            aria-invalid={touched && !phoneOk}
          />
        </span>
        {touched && !phoneOk && (
          <span className="text-[13px] text-destructive">{t('form.phoneErr')}</span>
        )}
      </label>
      <label className="grid gap-1.5">
        <span className="text-[14px] font-semibold">
          {t('form.note')}{' '}
          <span className="font-normal text-muted-foreground">{t('form.optional')}</span>
        </span>
        <textarea
          className={cn(field, 'min-h-20 border-input py-2.5')}
          maxLength={300}
          value={note}
          placeholder={t('form.notePh')}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {useCaptcha && <Turnstile onToken={setCaptcha} resetKey={captchaReset} />}
      {/* honeypot: hidden from people, bots fill it */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />
      <label className="flex cursor-pointer gap-3 text-[14px]">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-foreground"
        />
        <span>
          {t('form.consent')}{' '}
          <a
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand underline-offset-2 hover:underline"
          >
            {t('form.privacy')}
          </a>
        </span>
      </label>
      {touched && !consent && (
        <p className="text-[13px] text-destructive">{t('form.consentErr')}</p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-[#f0c4bf] bg-destructive/10 px-3.5 py-3 text-[14px] text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  )

  const viewSuccess = (
    <div className="grid gap-4 pt-6 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-success text-white">
        <CheckIcon className="size-8" strokeWidth={3} aria-hidden="true" />
      </span>
      <h1 className="font-heading text-[26px] font-semibold">
        {result?.status === 'confirmed' ? t('success.titleConfirmed') : t('success.titlePending')}
      </h1>
      <p className="text-muted-foreground">
        {result?.status === 'confirmed'
          ? t('success.textConfirmed', { name: name.trim() })
          : t('success.textPending', { name: name.trim() })}
      </p>
      <span
        className={cn(
          'mx-auto rounded-full px-3 py-1 text-[13px] font-semibold',
          result?.status === 'confirmed'
            ? 'bg-success/15 text-success'
            : 'bg-brand-soft text-brand',
        )}
      >
        {result?.status === 'confirmed' ? t('success.confirmed') : t('success.pending')}
      </span>
      <div className="text-left">{summary(false)}</div>
      <div className="grid gap-2.5">
        {salon.phone && (
          <a
            href={`tel:${salon.phone}`}
            className="grid min-h-[54px] place-items-center rounded-full font-semibold shadow-[inset_0_0_0_1.5px_var(--input)]"
          >
            {t('call')}
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            resetFlow()
            go(1)
          }}
          className="min-h-[54px] rounded-full bg-foreground font-semibold text-background"
        >
          {t('success.again')}
        </button>
        {tg && (
          <button
            type="button"
            onClick={() => tg.close()}
            className="min-h-[54px] rounded-full font-semibold shadow-[inset_0_0_0_1.5px_var(--input)]"
          >
            {t('close')}
          </button>
        )}
      </div>
      <p className="text-[13px] text-muted-foreground">{t('success.fine')}</p>
    </div>
  )

  /* ------------------------------ Telegram Mini App ------------------------------ */
  // brand colours inside Telegram; Telegram's BackButton + MainButton replace ours
  useEffect(() => {
    if (!tg) return
    tg.ready()
    tg.expand()
    tg.setHeaderColor(BRAND.bg)
    tg.setBackgroundColor(BRAND.bg)
    if (tg.isVersionAtLeast('7.10')) tg.setBottomBarColor?.(BRAND.surface)
  }, [tg])
  const nextRef = useRef(next)
  nextRef.current = next
  useEffect(() => {
    if (!tg) return
    const back = () => history.back()
    const main = () => nextRef.current()
    tg.BackButton.onClick(back)
    tg.MainButton.onClick(main)
    return () => {
      tg.BackButton.offClick(back)
      tg.MainButton.offClick(main)
    }
  }, [tg])

  /* ------------------------------ bottom bar ------------------------------ */
  let sumTitle = ''
  let sumSub = ''
  let enabled = false
  if (step === 1) {
    sumTitle = service ? service.name : t('summary.noService')
    sumSub = service
      ? `${minutes(service.durationMinutes)} · ${formatUzs(service.priceUzs)}`
      : t('summary.pickOne')
    enabled = !!service
  } else if (step === 2 && service) {
    sumTitle = staff ? `${service.name} · ${staff.fullName}` : service.name
    sumSub = formatUzs(service.priceUzs)
    enabled = !!staff
  } else if (step === 3 && service && staff) {
    sumTitle =
      time && day
        ? `${dayLabel(day)}, ${formatTime(time, tz)}`
        : `${staff.fullName} · ${service.name}`
    sumSub = time ? `${staff.fullName} · ${service.name}` : t('summary.pickTime')
    enabled = !!time
  } else if (step === 4 && service) {
    sumTitle = formatUzs(service.priceUzs)
    sumSub = t('summary.payAtSalon')
    enabled = !submitting
  }

  // nearest free times for the SLOT_TAKEN sheet (from the refreshed list of that day)
  const alternatives = taken
    ? (slots.data ?? [])
        .slice()
        .sort(
          (a, b) =>
            Math.abs(Date.parse(a) - Date.parse(taken)) -
            Math.abs(Date.parse(b) - Date.parse(taken)),
        )
        .slice(0, 4)
        .sort()
    : []

  const gallery = salon.gallery
  const mainLabel = step === 4 ? (submitting ? t('submitting') : t('submit')) : t('next')
  useEffect(() => {
    if (!tg) return
    if (step > 1 || photo !== null || taken) tg.BackButton.show()
    else tg.BackButton.hide()
    if (step <= 4 && !taken && photo === null) {
      tg.MainButton.setParams({
        text: mainLabel,
        color: enabled ? BRAND.ink : '#e7ded2',
        text_color: enabled ? BRAND.onInk : '#a99c8c',
        is_active: enabled,
        is_visible: true,
      })
      if (submitting) tg.MainButton.showProgress(false)
      else tg.MainButton.hideProgress()
    } else tg.MainButton.hide()
  }, [tg, step, photo, taken, enabled, submitting, mainLabel])

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-background min-[481px]:shadow-[0_0_40px_rgba(40,25,10,0.12)]">
      {header}
      <main className="flex-1 px-4 pt-2.5 pb-6">
        {step === 1 && viewService}
        {step === 2 && viewStaff}
        {step === 3 && viewTime}
        {step === 4 && viewContact}
        {step === 5 && viewSuccess}
      </main>

      {step <= 4 && (
        <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-surface px-4 pt-3 pb-[calc(14px+env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[15px]">{sumTitle}</b>
            <span className="text-[12.5px] text-muted-foreground">{sumSub}</span>
          </div>
          <button
            type="button"
            disabled={!enabled}
            onClick={next}
            hidden={!!tg}
            className="inline-flex min-h-[54px] items-center gap-2 rounded-full bg-foreground px-6 text-base font-semibold text-background disabled:bg-secondary disabled:text-muted-foreground"
          >
            {step === 4 ? (
              submitting ? (
                <>
                  <Loader2Icon className="size-[18px] animate-spin" aria-hidden="true" />{' '}
                  {t('submitting')}
                </>
              ) : (
                t('submit')
              )
            ) : (
              t('next')
            )}
          </button>
        </div>
      )}

      {/* SLOT_TAKEN bottom sheet — the form stays filled in */}
      {taken && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/45"
          onClick={(e) => e.target === e.currentTarget && history.back()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="taken-title"
            className="w-full max-w-[480px] rounded-t-[22px] bg-surface px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded bg-border" />
            <h2 id="taken-title" className="font-heading text-[21px] font-semibold">
              {t('taken.title')}
            </h2>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              {t('taken.text', { when: `${dayLabel(day!)}, ${formatTime(taken, tz)}` })}
            </p>
            <p className="mt-4 mb-2 text-[13px] font-semibold text-muted-foreground">
              {t('taken.nearest')}
            </p>
            {slots.isFetching ? (
              <Loader2Icon
                className="size-5 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            ) : alternatives.length ? (
              <div className="grid grid-cols-4 gap-2">
                {alternatives.map((iso) =>
                  slotButton(iso, false, () => {
                    setTime(iso)
                    setTaken(null)
                  }),
                )}
              </div>
            ) : (
              <p className="text-[14px] text-muted-foreground">{t('taken.none')}</p>
            )}
            <button
              type="button"
              onClick={() => history.back()}
              className="mt-4 min-h-[54px] w-full rounded-full font-semibold shadow-[inset_0_0_0_1.5px_var(--input)]"
            >
              {t('taken.other')}
            </button>
          </div>
        </div>
      )}

      {/* «Ishlarimiz» viewer — the phone's Back closes it */}
      {photo !== null && gallery[photo] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('works')}
          className="fixed inset-0 z-50 flex flex-col bg-[#14110e] text-white"
        >
          <div className="flex items-center justify-between px-4 pt-3">
            <span className="text-[14px] font-semibold">
              {t('viewer.count', { n: photo + 1, total: gallery.length })}
            </span>
            <button
              type="button"
              onClick={() => history.back()}
              aria-label={t('viewer.close')}
              className="grid size-12 place-items-center rounded-full bg-white/12"
            >
              <XIcon className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center p-3">
            <img
              src={imageUrls(gallery[photo].path)?.lg}
              alt={t('workAlt', { n: photo + 1 })}
              className="max-h-full max-w-full rounded-xl object-contain"
            />
          </div>
          <div className="flex justify-between px-4 pb-[calc(18px+env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={photo === 0}
              onClick={() => setPhoto(photo - 1)}
              aria-label={t('viewer.prev')}
              className="grid size-12 place-items-center rounded-full bg-white/12 text-2xl disabled:opacity-30"
            >
              ‹
            </button>
            <button
              type="button"
              disabled={photo === gallery.length - 1}
              onClick={() => setPhoto(photo + 1)}
              aria-label={t('viewer.next')}
              className="grid size-12 place-items-center rounded-full bg-white/12 text-2xl disabled:opacity-30"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
