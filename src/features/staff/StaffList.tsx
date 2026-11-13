import { cn } from 'cn'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { InitialsAvatar } from '@/components/common/InitialsAvatar'
import { Switch } from '@/components/ui/switch'
import type { StaffItem } from './api'
import { formatDay } from './hours'

/** One row per barber: tap opens the barber page; the switch toggles active (approved mockup). */
export function StaffList({
  staff,
  onToggle,
}: {
  staff: StaffItem[]
  onToggle: (s: StaffItem, next: boolean) => void
}) {
  const { t } = useTranslation('admin')

  return (
    <ul className="grid gap-2.5">
      {staff.map((s) => (
        <li
          key={s.id}
          className={cn(
            'flex items-center gap-3.5 rounded-2xl border-[1.5px] px-4 py-3.5 transition-colors',
            s.isActive
              ? 'border-border bg-surface hover:border-input'
              : 'border-dashed border-input bg-transparent',
          )}
        >
          <Link
            to={`/admin/staff/${s.id}`}
            className="flex min-w-0 flex-1 items-center gap-3.5 outline-none focus-visible:rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <InitialsAvatar name={s.fullName} active={s.isActive} />
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-[15.5px] font-semibold',
                  !s.isActive && 'text-muted-foreground',
                )}
              >
                {s.fullName}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted-foreground">
                <span>
                  {s.todayHours.length
                    ? t('staff.today', { hours: formatDay(s.todayHours) })
                    : t('staff.todayOff')}
                </span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                  {t('staff.servicesCount', { count: s.serviceIds.length })}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    s.hasLogin ? 'bg-success-soft text-success' : 'bg-muted',
                  )}
                >
                  {s.hasLogin ? t('staff.hasLogin') : t('staff.noLogin')}
                </span>
                {!s.isActive && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
                    {t('staff.inactive')}
                  </span>
                )}
              </span>
            </span>
          </Link>
          <Switch
            checked={s.isActive}
            onCheckedChange={(next) => onToggle(s, next)}
            aria-label={t('staff.activeLabel', { name: s.fullName })}
          />
        </li>
      ))}
    </ul>
  )
}
