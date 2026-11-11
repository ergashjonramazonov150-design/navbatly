import { useTranslation } from 'react-i18next'

import { PlaceholderPage } from '@/components/common/PlaceholderPage'

export function SettingsPage() {
  const { t } = useTranslation('admin')
  return (
    <PlaceholderPage
      title={t('nav.settings')}
      description={t('placeholder.settings')}
      milestone="M3"
    />
  )
}
