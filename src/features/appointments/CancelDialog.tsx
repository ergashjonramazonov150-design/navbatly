import { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'

/** Cancel a booking: optional reason (ready-made chips or own text, ≤ 200) — mockup 03. */
export function CancelDialog({
  summary,
  busy,
  onConfirm,
  onClose,
}: {
  summary: string
  busy: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
  const [reason, setReason] = useState('')
  const chips = [
    t('appointments.cancelDialog.r1'),
    t('appointments.cancelDialog.r2'),
    t('appointments.cancelDialog.r3'),
  ]
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('appointments.cancelDialog.title')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3">
          <DialogDescription className="font-semibold text-foreground">{summary}</DialogDescription>
          <span className="text-[13.5px] font-semibold">
            {t('appointments.cancelDialog.reason')}{' '}
            <span className="font-normal text-muted-foreground">
              {t('appointments.cancelDialog.optional')}
            </span>
          </span>
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={reason === c}
                onClick={() => setReason(c)}
                className="min-h-10 rounded-full border-[1.5px] border-input px-3.5 text-[13.5px] font-semibold aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
              >
                {c}
              </button>
            ))}
          </div>
          <Textarea
            value={reason}
            maxLength={200}
            rows={2}
            placeholder={t('appointments.cancelDialog.placeholder')}
            aria-label={t('appointments.cancelDialog.reason')}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-[13px] text-muted-foreground">
            {t('appointments.cancelDialog.hint')}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t('appointments.cancelDialog.back')}
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(reason)} disabled={busy}>
            {busy ? t('actions.saving') : t('appointments.cancelDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
