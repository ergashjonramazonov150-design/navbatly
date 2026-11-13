import { Loader2Icon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { InfoNote, LoadError, PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { useReadyBusiness } from '@/features/business/useBusiness'
import { useStaffList } from '@/features/staff/api'
import { StaffFormDialog } from '@/features/staff/StaffFormDialog'
import { StaffList } from '@/features/staff/StaffList'
import { useStaffActiveToggle } from '@/features/staff/useStaffActiveToggle'

export function StaffPage() {
  const { t } = useTranslation('admin')
  const { businessId, timezone } = useReadyBusiness()
  const staff = useStaffList(businessId, timezone)
  const { toggle, dialog } = useStaffActiveToggle(businessId)
  const [creating, setCreating] = useState(false)
  const nextSortOrder = Math.max(0, ...(staff.data ?? []).map((s) => s.sortOrder)) + 1

  return (
    <>
      <PageHeader
        title={t('staff.title')}
        subtitle={t('staff.subtitle')}
        action={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon aria-hidden="true" />
            {t('staff.new')}
          </Button>
        }
      />

      {staff.isPending ? (
        <div role="status" className="flex items-center gap-3 py-10 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
          {t('account.loading')}
        </div>
      ) : staff.isError ? (
        <LoadError
          text={t('staff.loadError')}
          retryLabel={t('actions.retry')}
          onRetry={() => staff.refetch()}
        />
      ) : staff.data.length === 0 ? (
        <div className="rounded-2xl border-[1.5px] border-dashed border-input px-4 py-10 text-center text-muted-foreground">
          <p className="font-heading text-lg font-semibold text-foreground">{t('staff.empty')}</p>
          <p className="mt-1">{t('staff.emptyHint')}</p>
        </div>
      ) : (
        <StaffList staff={staff.data} onToggle={toggle} />
      )}

      <div className="mt-4 grid gap-2">
        <InfoNote>ℹ️ {t('staff.noDeleteHint')}</InfoNote>
        <InfoNote>🔑 {t('staff.loginNote')}</InfoNote>
      </div>

      {creating && (
        <StaffFormDialog
          businessId={businessId}
          nextSortOrder={nextSortOrder}
          onClose={() => setCreating(false)}
        />
      )}
      {dialog}
    </>
  )
}
