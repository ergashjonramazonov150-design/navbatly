import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { dbErrorKey } from '@/lib/dbErrors'
import { useSetStaffActive, type StaffItem } from './api'
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
  const [pending, setPending] = useState<StaffItem | null>(null)

  const apply = (s: StaffItem, isActive: boolean) =>
    setActive.mutate(
      { id: s.id, isActive },
      {
        onSuccess: () =>
          toast.success(
            t(isActive ? 'staff.activated' : 'staff.deactivated', { name: s.fullName }),
          ),
        onError: (err) => toast.error(t(`errors:${dbErrorKey(err)}`)),
      },
    )

  const toggle = (s: StaffItem, next: boolean) => (next ? apply(s, true) : setPending(s))

  const dialog = pending ? (
    <DeactivateStaffDialog
      staff={pending}
      onClose={() => setPending(null)}
      onConfirm={() => {
        apply(pending, false)
        setPending(null)
      }}
    />
  ) : null

  return { toggle, dialog }
}
