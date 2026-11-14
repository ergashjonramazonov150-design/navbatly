import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ImpactConfirmDialog } from '@/components/common/ImpactConfirmDialog'
import { countFutureBookingsForStaff, type StaffItem } from './api'

/**
 * Deactivate warning: "Jasurning N ta kelgusi yozilishi bor — bekor qiling yoki …".
 * If the barber has a photo: an UNTICKED "Rasmini ham olib tashlash" option (approved 2b —
 * the barber may come back).
 */
export function DeactivateStaffDialog({
  staff,
  onConfirm,
  onClose,
}: {
  staff: StaffItem
  onConfirm: (removePhoto: boolean) => void
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
  const [removePhoto, setRemovePhoto] = useState(false)
  const future = useQuery({
    queryKey: ['future-bookings', 'staff', staff.id],
    queryFn: () => countFutureBookingsForStaff(staff.id),
    staleTime: 0,
  })
  const name = staff.fullName
  return (
    <ImpactConfirmDialog
      title={t('staff.deactivate.title', { name })}
      checking={future.isPending}
      count={future.data}
      someText={(count) => t('staff.deactivate.some', { name, count })}
      noneText={t('staff.deactivate.none', { name })}
      extra={
        <>
          {staff.hasLogin && (
            <p className="text-muted-foreground">🔑 {t('staff.deactivate.loginBlocked')}</p>
          )}
          {staff.photoPath && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] border-border px-3.5 py-3 text-foreground">
              <input
                type="checkbox"
                checked={removePhoto}
                onChange={(e) => setRemovePhoto(e.target.checked)}
                className="mt-0.5 size-[22px] shrink-0 accent-destructive"
              />
              <span>
                <b className="block">{t('photos.staff.deactivateRemove')}</b>
                <span className="text-[12.5px] text-muted-foreground">
                  {t('photos.staff.deactivateRemoveHint')}
                </span>
              </span>
            </label>
          )}
        </>
      }
      confirmLabel={t('staff.deactivate.confirm')}
      confirmVariant="destructive"
      onConfirm={() => onConfirm(removePhoto)}
      onClose={onClose}
    />
  )
}
