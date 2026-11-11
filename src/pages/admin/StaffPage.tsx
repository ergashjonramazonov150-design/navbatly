import { useTranslation } from 'react-i18next'

import { PlaceholderPage } from '@/components/common/PlaceholderPage'

export function StaffPage() {
  const { t } = useTranslation('admin')
  return (
    <PlaceholderPage title={t('nav.staff')} description={t('placeholder.staff')} milestone="M3" />
  )
}
