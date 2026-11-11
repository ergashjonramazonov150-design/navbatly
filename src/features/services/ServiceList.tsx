import { cn } from 'cn'
import { useTranslation } from 'react-i18next'

import { Switch } from '@/components/ui/switch'
import { formatUzs } from '@/lib/money'
import type { ServiceItem } from './api'

/** One row per service: tap the row to edit, the switch toggles active (approved mockup). */
export function ServiceList({
  services,
  onEdit,
  onToggle,
}: {
  services: ServiceItem[]
  onEdit: (s: ServiceItem) => void
  onToggle: (s: ServiceItem, next: boolean) => void
}) {
  const { t } = useTranslation('admin')

  return (
    <ul className="grid gap-2.5">
      {services.map((s) => (
        <li
          key={s.id}
          className={cn(
            'flex items-center gap-3.5 rounded-2xl border-[1.5px] px-4 py-3.5 transition-colors',
            s.isActive
              ? 'border-border bg-surface hover:border-input'
              : 'border-dashed border-input bg-transparent',
          )}
        >
          <button
            type="button"
            onClick={() => onEdit(s)}
            className="min-w-0 flex-1 text-left outline-none focus-visible:rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span
              className={cn(
                'block text-[15.5px] font-semibold',
                !s.isActive && 'text-muted-foreground',
              )}
            >
              {s.name}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted-foreground">
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                {t('services.minutes', { count: s.durationMinutes })}
              </span>
              {s.staffCount > 0 ? (
                <span>{t('services.staffCount', { count: s.staffCount })}</span>
              ) : (
                <span className="font-semibold text-brand" title={t('services.noStaffHint')}>
                  ⚠️ {t('services.noStaff')}
                </span>
              )}
              {!s.isActive && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
                  {t('services.inactive')}
                </span>
              )}
              {s.description && <span className="min-w-0 truncate">{s.description}</span>}
            </span>
            <span className="mt-1 block font-bold whitespace-nowrap min-[600px]:hidden">
              {formatUzs(s.priceUzs)}
            </span>
          </button>
          <span className="hidden font-bold whitespace-nowrap min-[600px]:block">
            {formatUzs(s.priceUzs)}
          </span>
          <Switch
            checked={s.isActive}
            onCheckedChange={(next) => onToggle(s, next)}
            aria-label={t('services.activeLabel', { name: s.name })}
          />
        </li>
      ))}
    </ul>
  )
}
