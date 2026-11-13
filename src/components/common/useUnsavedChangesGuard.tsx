import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * While `dirty`: asks before leaving the page inside the app (incl. tab switches via
 * ?tab=), and lets the browser warn on refresh/close. Render the returned `dialog`.
 */
export function useUnsavedChangesGuard(dirty: boolean, text: string) {
  const { t } = useTranslation('admin')
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  )
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const dialog =
    blocker.state === 'blocked' ? (
      <Dialog open onOpenChange={(open) => !open && blocker.reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('hours.leaveTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription>{text}</DialogDescription>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => blocker.reset()}>
              {t('hours.stay')}
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed()}>
              {t('hours.leave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ) : null

  return dialog
}
