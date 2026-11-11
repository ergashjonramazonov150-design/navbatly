import { useQuery } from '@tanstack/react-query'
import { Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
import { countFutureBookingsForService, type ServiceItem } from './api'

/**
 * Confirms deactivating a service and says how many FUTURE bookings use it.
 * Bookings are never changed automatically (docs: "never change bookings automatically").
 */
export function DeactivateServiceDialog({
  service,
  onConfirm,
  onClose,
}: {
  service: ServiceItem
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
  const future = useQuery({
    queryKey: ['future-bookings', 'service', service.id],
    queryFn: () => countFutureBookingsForService(service.id),
    staleTime: 0,
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('services.deactivate.title', { name: service.name })}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription asChild>
            <div
              role="status"
              className={
                future.data
                  ? 'rounded-xl border border-[#ecc9b4] bg-brand-soft px-3.5 py-3 text-[14px] text-[#6d2f14]'
                  : 'text-[14px]'
              }
            >
              {future.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  {t('services.deactivate.checking')}
                </span>
              ) : future.data ? (
                <>⚠️ {t('services.deactivate.some', { count: future.data })}</>
              ) : (
                t('services.deactivate.none')
              )}
            </div>
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button variant="destructive" disabled={future.isPending} onClick={onConfirm}>
            {t('services.deactivate.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
