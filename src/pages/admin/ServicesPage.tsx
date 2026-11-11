import { Loader2Icon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useReadyBusiness } from '@/features/business/useBusiness'
import { useServices, useSetServiceActive, type ServiceItem } from '@/features/services/api'
import { DeactivateServiceDialog } from '@/features/services/DeactivateServiceDialog'
import { ServiceFormDialog } from '@/features/services/ServiceFormDialog'
import { ServiceList } from '@/features/services/ServiceList'
import { dbErrorKey } from '@/lib/dbErrors'

type Editing = { mode: 'create' } | { mode: 'edit'; service: ServiceItem } | null

export function ServicesPage() {
  const { t } = useTranslation(['admin', 'errors'])
  const { businessId } = useReadyBusiness()
  const services = useServices(businessId)
  const setActive = useSetServiceActive(businessId)
  const [editing, setEditing] = useState<Editing>(null)
  const [deactivating, setDeactivating] = useState<ServiceItem | null>(null)

  const nextSortOrder = Math.max(0, ...(services.data ?? []).map((s) => s.sortOrder)) + 1

  const changeActive = (s: ServiceItem, isActive: boolean) =>
    setActive.mutate(
      { id: s.id, isActive },
      {
        onSuccess: () =>
          toast.success(
            t(isActive ? 'services.activated' : 'services.deactivated', { name: s.name }),
          ),
        onError: (err) => toast.error(t(`errors:${dbErrorKey(err)}`)),
      },
    )

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] flex-1">
          <h1 className="text-[25px] leading-tight font-semibold tracking-tight min-[900px]:text-3xl">
            {t('services.title')}
          </h1>
          <p className="mt-1 text-muted-foreground">{t('services.subtitle')}</p>
        </div>
        <Button onClick={() => setEditing({ mode: 'create' })}>
          <PlusIcon aria-hidden="true" />
          {t('services.new')}
        </Button>
      </div>

      {services.isPending ? (
        <div role="status" className="flex items-center gap-3 py-10 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
          {t('account.loading')}
        </div>
      ) : services.isError ? (
        <div
          role="alert"
          className="rounded-2xl border border-[#f0c4bf] bg-danger-soft px-4 py-4 text-destructive"
        >
          <p>{t('services.loadError')}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => services.refetch()}>
            {t('actions.retry')}
          </Button>
        </div>
      ) : services.data.length === 0 ? (
        <div className="rounded-2xl border-[1.5px] border-dashed border-input px-4 py-10 text-center text-muted-foreground">
          <p className="font-heading text-lg font-semibold text-foreground">
            {t('services.empty')}
          </p>
          <p className="mt-1">{t('services.emptyHint')}</p>
        </div>
      ) : (
        <ServiceList
          services={services.data}
          onEdit={(service) => setEditing({ mode: 'edit', service })}
          onToggle={(s, next) => (next ? changeActive(s, true) : setDeactivating(s))}
        />
      )}

      <p className="mt-4 rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-[13px] text-muted-foreground">
        ℹ️ {t('services.noDeleteHint')}
      </p>

      {editing && (
        <ServiceFormDialog
          businessId={businessId}
          service={editing.mode === 'edit' ? editing.service : undefined}
          nextSortOrder={nextSortOrder}
          onClose={() => setEditing(null)}
        />
      )}
      {deactivating && (
        <DeactivateServiceDialog
          service={deactivating}
          onClose={() => setDeactivating(null)}
          onConfirm={() => {
            changeActive(deactivating, false)
            setDeactivating(null)
          }}
        />
      )}
    </>
  )
}
