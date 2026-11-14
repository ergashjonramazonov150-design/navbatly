import { cn } from 'cn'
import { ClockIcon, MapPinIcon, PhoneIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { imageUrls } from '@/features/images/api'
import { formatLocal, toLocalDigits } from '@/lib/phone'
import { useSalonOpeningHours, type PublicSalon } from './api'

/*
 * Desktop (≥1024px) left column of the booking page: logo, name, address, opening hours,
 * call button, barbers, «Ishlarimiz». Phones never render it (the wizard's own header and
 * the service step show the same things there).
 */
export function SalonInfoPanel({
  salon,
  todayWeekday,
  hasCover,
  onOpenPhoto,
}: {
  salon: PublicSalon
  /** 1 = Monday … 7 = Sunday, in the salon's timezone */
  todayWeekday: number
  hasCover: boolean
  onOpenPhoto: (index: number) => void
}) {
  const { t } = useTranslation('booking')
  const hours = useSalonOpeningHours(salon.id, true)
  const logo = imageUrls(salon.logoPath)
  const initial = salon.name.trim()[0]?.toUpperCase()

  return (
    <div className="pb-6">
      <div className={hasCover ? '-mt-14' : 'mt-10'}>
        {logo ? (
          <img
            src={logo.lg}
            alt=""
            className="size-28 shrink-0 rounded-[28px] border border-border bg-surface object-contain shadow-[0_0_0_5px_var(--background)]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-28 shrink-0 place-items-center rounded-[28px] bg-brand font-heading text-5xl font-bold text-white shadow-[0_0_0_5px_var(--background)]"
          >
            {initial}
          </span>
        )}
        <div className="mt-4 min-w-0">
          <h2 className="font-heading text-[38px] leading-[1.1] font-semibold tracking-tight">
            {salon.name}
          </h2>
          {salon.address && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[15px] text-muted-foreground">
              <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
              {salon.address}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-start gap-4">
        {hours.data && hours.data.length > 0 ? (
          <section
            aria-labelledby="hours-title"
            className="max-w-[380px] min-w-[300px] flex-1 rounded-2xl border-[1.5px] border-border bg-surface px-5 py-4"
          >
            <h3
              id="hours-title"
              className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-muted-foreground"
            >
              <ClockIcon className="size-4" aria-hidden="true" />
              {t('info.hours')}
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[15px]">
              {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
                const h = hours.data.find((r) => r.weekday === wd)
                const today = wd === todayWeekday
                return (
                  <div key={wd} className={cn('contents', today && 'font-bold')}>
                    <dt>
                      {t(`wdLong.${wd}` as 'wdLong.1')}
                      {today && (
                        <span className="ml-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand">
                          {t('dayToday')}
                        </span>
                      )}
                    </dt>
                    <dd
                      className={cn(
                        'whitespace-nowrap tabular-nums',
                        !h && 'text-muted-foreground',
                      )}
                    >
                      {h ? `${h.opens} – ${h.closes}` : t('info.closed')}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </section>
        ) : null}
        {salon.phone && (
          <a
            href={`tel:${salon.phone}`}
            className="inline-flex min-h-12 items-center gap-2.5 rounded-full px-5 font-semibold shadow-[inset_0_0_0_1.5px_var(--input)] hover:bg-surface"
          >
            <PhoneIcon className="size-[18px]" aria-hidden="true" />
            +998 {formatLocal(toLocalDigits(salon.phone))}
          </a>
        )}
      </div>

      {salon.staff.length > 0 && (
        <section className="mt-9" aria-labelledby="barbers-title">
          <h3 id="barbers-title" className="mb-3 font-heading text-[22px] font-semibold">
            {t('info.barbers')}
          </h3>
          <ul className="grid grid-cols-2 gap-3">
            {salon.staff.map((st) => {
              const img = imageUrls(st.photoPath)
              return (
                <li
                  key={st.id}
                  className="flex items-center gap-3.5 rounded-2xl border-[1.5px] border-border bg-surface px-4 py-3"
                >
                  {img ? (
                    <img
                      src={img.sm}
                      alt=""
                      loading="lazy"
                      className="size-14 shrink-0 rounded-full bg-secondary object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="grid size-14 shrink-0 place-items-center rounded-full bg-secondary font-heading text-xl font-semibold text-secondary-foreground"
                    >
                      {st.fullName.trim()[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block font-semibold">{st.fullName}</span>
                    {st.bio && (
                      <span className="line-clamp-2 text-[13.5px] text-muted-foreground">
                        {st.bio}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {salon.gallery.length > 0 && (
        <section className="mt-9" aria-labelledby="works-desktop-title">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 id="works-desktop-title" className="font-heading text-[22px] font-semibold">
              {t('works')}
            </h3>
            <span className="text-[13px] font-semibold text-muted-foreground">
              {t('worksCount', { count: salon.gallery.length })}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {salon.gallery.map((g, i) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onOpenPhoto(i)}
                aria-label={t('zoom', { n: i + 1 })}
                className="aspect-square overflow-hidden rounded-2xl bg-secondary"
              >
                <img
                  src={imageUrls(g.path)?.sm}
                  alt={t('workAlt', { n: i + 1 })}
                  loading="lazy"
                  className="size-full object-cover transition-transform hover:scale-[1.03]"
                />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
