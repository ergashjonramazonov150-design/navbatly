import { RotateCwIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouteError } from 'react-router'

import { FullScreenMessage } from '@/components/common/FullScreenMessage'
import { Button } from '@/components/ui/button'

/**
 * Shown when a page crashes while rendering (instead of React Router's English
 * "Unexpected Application Error!"). The technical error goes to the console only.
 */
export function RouteErrorScreen() {
  const { t } = useTranslation('admin')
  const error = useRouteError()

  useEffect(() => {
    console.error('[navbatly] page crashed:', error)
  }, [error])

  return (
    <FullScreenMessage
      tone="warning"
      title={t('crash.title')}
      actions={
        <Button onClick={() => window.location.reload()}>
          <RotateCwIcon aria-hidden="true" />
          {t('crash.reload')}
        </Button>
      }
    >
      {t('crash.text')}
    </FullScreenMessage>
  )
}
