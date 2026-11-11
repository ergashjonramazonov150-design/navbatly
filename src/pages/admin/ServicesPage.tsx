import { useTranslation } from 'react-i18next'

import { PlaceholderPage } from '@/components/common/PlaceholderPage'

export function ServicesPage() {
  const { t } = useTranslation('admin')
  return (
    <PlaceholderPage
      title={t('nav.services')}
      description={t('placeholder.services')}
      milestone="M3"
    />
  )
}
