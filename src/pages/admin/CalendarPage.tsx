import { useTranslation } from 'react-i18next'

import { PlaceholderPage } from '@/components/common/PlaceholderPage'

export function CalendarPage() {
  const { t } = useTranslation('admin')
  return (
    <PlaceholderPage
      title={t('nav.calendar')}
      description={t('placeholder.calendar')}
      milestone="M5"
    />
  )
}
