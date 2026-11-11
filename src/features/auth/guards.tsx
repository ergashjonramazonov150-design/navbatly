import { LogOutIcon, RotateCwIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'

import { FullScreenLoader, FullScreenMessage } from '@/components/common/FullScreenMessage'
import { Button } from '@/components/ui/button'
import { BusinessProvider } from '@/features/business/BusinessProvider'
import { useBusiness } from '@/features/business/useBusiness'
import { useAuth } from './useAuth'

/*
 * Route guards — UX only. The real protection is RLS in the database:
 * even if someone bypassed these, they could not read another salon's data.
 */

export const LOGIN_PATH = '/admin/login'
export const HOME_PATH = '/admin/appointments'

/** Logged-out users → login page (remembering where they wanted to go). */
export function RequireAuth() {
  const { t } = useTranslation('admin')
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') return <FullScreenLoader label={t('account.loading')} />
  if (state.status === 'signedOut') {
    return <Navigate to={LOGIN_PATH} replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Login page for someone already logged in → go to the panel. */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { t } = useTranslation('admin')
  const { state } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  if (state.status === 'loading') return <FullScreenLoader label={t('account.loading')} />
  if (state.status === 'signedIn') return <Navigate to={from ?? HOME_PATH} replace />
  return children
}

function LogoutButton() {
  const { t } = useTranslation('admin')
  const { signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <Button
      onClick={async () => {
        await signOut()
        navigate(LOGIN_PATH, { replace: true })
      }}
    >
      <LogOutIcon aria-hidden="true" />
      {t('logout')}
    </Button>
  )
}

/** Shows the right screen for "loading / error / no salon / inactive"; otherwise lets the user in. */
export function RequireBusiness() {
  const { t } = useTranslation('admin')
  const business = useBusiness()

  switch (business.status) {
    case 'loading':
      return <FullScreenLoader label={t('account.loading')} />
    case 'error':
      return (
        <FullScreenMessage
          title={t('account.loadErrorTitle')}
          actions={
            <>
              <Button onClick={business.retry}>
                <RotateCwIcon aria-hidden="true" />
                {t('account.retry')}
              </Button>
              <LogoutButton />
            </>
          }
        >
          {t('account.loadError')}
        </FullScreenMessage>
      )
    case 'no-business':
      return (
        <FullScreenMessage title={t('account.noBusinessTitle')} actions={<LogoutButton />}>
          {t('account.noBusiness')}
        </FullScreenMessage>
      )
    case 'inactive':
      return (
        <FullScreenMessage
          tone="warning"
          title={t('account.inactiveTitle')}
          actions={<LogoutButton />}
        >
          {t('account.inactive')}
        </FullScreenMessage>
      )
    case 'ready':
      return <Outlet />
  }
}

/** Loads the salon context for the logged-in user, then applies RequireBusiness. */
export function BusinessGate() {
  const { state } = useAuth()
  if (state.status !== 'signedIn') return null // RequireAuth (parent route) handles this
  return (
    <BusinessProvider userId={state.user.id}>
      <RequireBusiness />
    </BusinessProvider>
  )
}

/** Owner-only pages: a staff member is sent to their appointments instead. */
export function RequireOwner() {
  const business = useBusiness()
  if (business.status !== 'ready' || business.role !== 'owner') {
    return <Navigate to={HOME_PATH} replace />
  }
  return <Outlet />
}
