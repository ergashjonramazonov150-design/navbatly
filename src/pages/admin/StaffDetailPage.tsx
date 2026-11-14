import { ChevronLeftIcon, Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'

import { InitialsAvatar } from '@/components/common/InitialsAvatar'
import { LoadError, PageHeader } from '@/components/common/PageHeader'
import { useReadyBusiness } from '@/features/business/useBusiness'
import { imageUrls } from '@/features/images/api'
import { useStaffList } from '@/features/staff/api'
import { HoursEditor } from '@/features/staff/HoursEditor'
import { ProfileTab } from '@/features/staff/ProfileTab'
import { StaffServicesTab } from '@/features/staff/StaffServicesTab'
import { TimeOffPanel } from '@/features/staff/TimeOffPanel'

const TABS = ['hours', 'services', 'timeOff', 'profile'] as const
type Tab = (typeof TABS)[number]

export function StaffDetailPage() {
  const { t } = useTranslation('admin')
  const { staffId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { businessId, timezone } = useReadyBusiness()
  const list = useStaffList(businessId, timezone)

  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'hours'
  const staff = list.data?.find((s) => s.id === staffId)

  const back = (
    <Link
      to="/admin/staff"
      className="mb-1 inline-flex min-h-11 items-center gap-1.5 font-semibold text-muted-foreground hover:text-foreground"
    >
      <ChevronLeftIcon className="size-5" aria-hidden="true" />
      {t('staff.back')}
    </Link>
  )

  if (list.isPending) {
    return (
      <div role="status" className="flex items-center gap-3 py-10 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
        {t('account.loading')}
      </div>
    )
  }
  if (list.isError) {
    return (
      <LoadError
        text={t('staff.loadError')}
        retryLabel={t('actions.retry')}
        onRetry={() => list.refetch()}
      />
    )
  }
  if (!staff) {
    return (
      <>
        {back}
        <p className="py-10 text-center text-muted-foreground">{t('staff.notFound')}</p>
      </>
    )
  }

  return (
    <>
      {back}
      <PageHeader
        leading={
          <InitialsAvatar
            name={staff.fullName}
            active={staff.isActive}
            className="size-14 text-xl"
            photoUrl={imageUrls(staff.photoPath)?.sm}
          />
        }
        title={staff.fullName}
        subtitle={
          <>
            {staff.bio}
            {!staff.isActive && (
              <span className="ml-2 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {t('staff.inactive')}
              </span>
            )}
          </>
        }
      />

      <div
        role="tablist"
        aria-label={staff.fullName}
        className="mb-4 flex gap-1 overflow-x-auto border-b-[1.5px] border-border"
      >
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setParams({ tab: id }, { replace: true })}
            className={`-mb-[1.5px] min-h-11 shrink-0 border-b-[2.5px] px-3.5 font-semibold whitespace-nowrap ${
              tab === id
                ? 'border-brand text-foreground'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            {t(`staff.tabs.${id}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'hours' && <HoursEditor staffId={staff.id} businessId={businessId} />}
        {tab === 'services' && <StaffServicesTab staff={staff} businessId={businessId} />}
        {tab === 'timeOff' && (
          <TimeOffPanel
            businessId={businessId}
            staffId={staff.id}
            timezone={timezone}
            title={t('timeOff.title')}
            hint={t('timeOff.hint', { name: staff.fullName })}
          />
        )}
        {tab === 'profile' && <ProfileTab staff={staff} businessId={businessId} />}
      </div>
    </>
  )
}
