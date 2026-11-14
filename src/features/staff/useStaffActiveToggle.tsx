import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { removeImage, saveStaffPhoto } from '@/features/images/api'
import { dbErrorKey } from '@/lib/dbErrors'
import { staffListKey, useSetStaffActive, type StaffItem } from './api'
import { DeactivateStaffDialog } from './DeactivateStaffDialog'

/**
 * Shared by the list and the Profile tab:
 *   switch ON  → activates immediately
 *   switch OFF → first shows how many future bookings the barber has
 *                ("… bekor qiling yoki mijozlar bilan bog'laning"), then deactivates.
 */
export function useStaffActiveToggle(businessId: string) {
  const { t } = useTranslation(['admin', 'errors'])
  const setActive = useSetStaffActive(businessId)
  const qc = useQueryClient()
  const [pending, setPending] = useState<StaffItem | null>(null)

  const apply = (s: StaffItem, isActive: boolean, removePhoto = false) =>
    setActive.mutate(
      { id: s.id, isActive },
      {
        onSuccess: async () => {
          toast.success(t(isActive ? 'staff.activated' : 'staff.deactivated', { name: s.fullName }))
          // "Rasmini ham olib tashlash": only AFTER the deactivation succeeded.
          // If this part fails the barber stays deactivated — the owner is told.
          if (removePhoto && s.photoPath) {
            try {
              await removeImage(s.photoPath, () => saveStaffPhoto(s.id, null))
            } catch {
              toast.error(t('photos.staff.deactivatePhotoFailed'))
            } finally {
              void qc.invalidateQueries({ queryKey: staffListKey(businessId) })
            }
          }
        },
        onError: (err) => toast.error(t(`errors:${dbErrorKey(err)}`)),
      },
    )

  const toggle = (s: StaffItem, next: boolean) => (next ? apply(s, true) : setPending(s))

  const dialog = pending ? (
    <DeactivateStaffDialog
      staff={pending}
      onClose={() => setPending(null)}
      onConfirm={(removePhoto) => {
        apply(pending, false, removePhoto)
        setPending(null)
      }}
    />
  ) : null

  return { toggle, dialog }
}
