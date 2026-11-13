import { Loader2Icon } from 'lucide-react'
import type { ReactNode } from 'react'
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

/**
 * "Are you sure?" dialog that shows how many FUTURE bookings a change affects.
 * Used for: shortening working hours, adding days off, deactivating a barber/service.
 * Bookings are never changed automatically — the owner decides (docs/ARCHITECTURE.md).
 */
export function ImpactConfirmDialog({
  title,
  checking,
  count,
  someText,
  noneText,
  extra,
  confirmLabel,
  confirmVariant = 'default',
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string
  checking: boolean
  count: number | undefined
  someText: (count: number) => string
  /** shown when count is 0 (omit → the dialog is normally not opened for 0) */
  noneText?: string
  extra?: ReactNode
  confirmLabel: string
  confirmVariant?: 'default' | 'destructive'
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
  const hasImpact = !!count && count > 0

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription asChild>
            <div role="status" className="grid gap-3 text-[14px]">
              {checking ? (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  {t('impact.checking')}
                </span>
              ) : hasImpact ? (
                <div className="rounded-xl border border-[#ecc9b4] bg-brand-soft px-3.5 py-3 text-[#6d2f14]">
                  <p className="font-semibold">⚠️ {someText(count)}</p>
                  <p className="mt-1">{t('impact.keepNote')}</p>
                </div>
              ) : (
                <p>{noneText}</p>
              )}
              {!checking && extra}
            </div>
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t('actions.cancel')}
          </Button>
          <Button variant={confirmVariant} disabled={checking || busy} onClick={onConfirm}>
            {busy ? t('actions.saving') : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
