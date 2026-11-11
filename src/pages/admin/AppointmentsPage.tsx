import { useTranslation } from 'react-i18next'

import { PlaceholderPage } from '@/components/common/PlaceholderPage'

export function AppointmentsPage() {
  const { t } = useTranslation('admin')
  return (
    <PlaceholderPage
      title={t('nav.appointments')}
      description={t('placeholder.appointments')}
      milestone="M5"
    />
  )
}
