import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { ImpactConfirmDialog } from '@/components/common/ImpactConfirmDialog'
import { countFutureBookingsForStaff, type StaffItem } from './api'

/** Deactivate warning: "Jasurning N ta kelgusi yozilishi bor — bekor qiling yoki …". */
export function DeactivateStaffDialog({
  staff,
  onConfirm,
  onClose,
}: {
  staff: StaffItem
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
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
        staff.hasLogin ? (
          <p className="text-muted-foreground">🔑 {t('staff.deactivate.loginBlocked')}</p>
        ) : undefined
      }
      confirmLabel={t('staff.deactivate.confirm')}
      confirmVariant="destructive"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
