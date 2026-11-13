import { Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { LoadError } from '@/components/common/PageHeader'
import { Switch } from '@/components/ui/switch'
import { useServices } from '@/features/services/api'
import { dbErrorKey } from '@/lib/dbErrors'
import { formatUzs } from '@/lib/money'
import { useToggleStaffService, type StaffItem } from './api'

/** Which services this barber performs (staff_services rows). Saves on each switch. */
export function StaffServicesTab({ staff, businessId }: { staff: StaffItem; businessId: string }) {
  const { t } = useTranslation(['admin', 'errors'])
  const services = useServices(businessId)
  const toggle = useToggleStaffService(businessId)
  const name = staff.fullName

  if (services.isPending) {
    return (
      <div role="status" className="flex items-center gap-3 py-10 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
        {t('account.loading')}
      </div>
    )
  }
  if (services.isError) {
    return (
      <LoadError
        text={t('services.loadError')}
        retryLabel={t('actions.retry')}
        onRetry={() => services.refetch()}
      />
    )
  }

  return (
    <section className="rounded-2xl border-[1.5px] border-border bg-surface p-4 min-[600px]:p-5">
      <h2 className="text-[19px] font-semibold">{t('staffServices.title', { name })}</h2>
      <p className="mt-1 mb-4 text-[13.5px] text-muted-foreground">
        {t('staffServices.hint', { name })}
      </p>
      <ul className="grid gap-2">
        {services.data.map((s) => {
          const on = staff.serviceIds.includes(s.id)
          return (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-3.5 rounded-xl border border-border bg-surface-2 px-3.5 py-3">
                <span className="min-w-0 flex-1">
                  <span
                    className={`block font-semibold ${s.isActive ? '' : 'text-muted-foreground'}`}
                  >
                    {s.name}
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-2 text-[13px] text-muted-foreground">
                    <span>{t('services.minutes', { count: s.durationMinutes })}</span>
                    <span>·</span>
                    <span>{formatUzs(s.priceUzs)}</span>
                    {!s.isActive && (
                      <span className="rounded-full bg-muted px-2 text-xs font-semibold">
                        {t('staffServices.inactive')}
                      </span>
                    )}
                  </span>
                </span>
                <Switch
                  checked={on}
                  disabled={toggle.isPending}
                  aria-label={t('staffServices.toggleLabel', { service: s.name, name })}
                  onCheckedChange={(enabled) =>
                    toggle.mutate(
                      { staffId: staff.id, serviceId: s.id, enabled },
                      {
                        onSuccess: () =>
                          toast.success(
                            t(enabled ? 'staffServices.added' : 'staffServices.removed', {
                              service: s.name,
                            }),
                          ),
                        onError: (err) => toast.error(t(`errors:${dbErrorKey(err)}`)),
                      },
                    )
                  }
                />
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
