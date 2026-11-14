import { Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LoadError, PageHeader } from '@/components/common/PageHeader'
import { SalonPhotosCard } from '@/features/business/SalonPhotosCard'
import { SettingsForm } from '@/features/business/SettingsForm'
import { useBusinessSettings } from '@/features/business/settingsApi'
import { useReadyBusiness } from '@/features/business/useBusiness'
import { TimeOffPanel } from '@/features/staff/TimeOffPanel'
import { TelegramCard } from '@/features/telegram/TelegramCard'

/*
 * Sozlamalar (owner only, delivery 3c): salon details + booking rules (one Save button),
 * then «Salon rasmlari» (M3.5, each photo saved immediately), then salon-wide closed days
 * (saved one by one, like a barber's days off), then «Telegram xabarnomalari» (M6).
 */
export function SettingsPage() {
  const { t } = useTranslation('admin')
  const { businessId, timezone } = useReadyBusiness()
  const settings = useBusinessSettings(businessId)

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      {settings.isPending ? (
        <div role="status" className="flex items-center gap-3 py-10 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
          {t('account.loading')}
        </div>
      ) : settings.isError ? (
        <LoadError
          text={t('settings.loadError')}
          retryLabel={t('actions.retry')}
          onRetry={() => settings.refetch()}
        />
      ) : (
        <div className="grid gap-4">
          <SettingsForm businessId={businessId} settings={settings.data} />
          <SalonPhotosCard businessId={businessId} salonName={settings.data.name} />
          <TimeOffPanel
            businessId={businessId}
            staffId={null}
            timezone={timezone}
            title={t('settings.closed.title')}
            hint={t('settings.closed.hint')}
            reasonPlaceholder={t('settings.closed.reasonPlaceholder')}
          />
          <TelegramCard businessId={businessId} slug={settings.data.slug} />
        </div>
      )}
    </>
  )
}
