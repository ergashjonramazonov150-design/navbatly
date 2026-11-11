import {
  CalendarDaysIcon,
  ListIcon,
  LogOutIcon,
  ScissorsIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useNavigate } from 'react-router'

import { Logo } from '@/components/common/Logo'
import { LOGIN_PATH } from '@/features/auth/guards'
import { useAuth } from '@/features/auth/useAuth'
import { useReadyBusiness } from '@/features/business/useBusiness'

type NavItem = {
  to: string
  key: 'appointments' | 'calendar' | 'services' | 'staff' | 'settings'
  icon: LucideIcon
  ownerOnly: boolean
}

const NAV: NavItem[] = [
  { to: '/admin/appointments', key: 'appointments', icon: ListIcon, ownerOnly: false },
  { to: '/admin/calendar', key: 'calendar', icon: CalendarDaysIcon, ownerOnly: false },
  { to: '/admin/services', key: 'services', icon: ScissorsIcon, ownerOnly: true },
  { to: '/admin/staff', key: 'staff', icon: UsersIcon, ownerOnly: true },
  { to: '/admin/settings', key: 'settings', icon: SlidersHorizontalIcon, ownerOnly: true },
]

/** Approved shell (design/03-admin.html): sidebar ≥ 900 px, top bar + bottom tabs on phones. */
export function AdminLayout() {
  const { t } = useTranslation('admin')
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const business = useReadyBusiness()
  const items = NAV.filter((n) => !n.ownerOnly || business.role === 'owner')
  const displayName =
    business.role === 'owner' ? (business.staffName ?? t('roles.owner')) : business.staffName

  const logout = async () => {
    await signOut()
    navigate(LOGIN_PATH, { replace: true })
  }

  return (
    <div className="min-h-dvh">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-62 flex-col border-r border-border bg-surface px-3.5 py-4.5 min-[900px]:flex">
        <div className="flex items-center gap-2.5 px-2 pb-4.5">
          <Logo className="size-9.5" />
          <div className="min-w-0">
            <p className="truncate text-sm leading-tight font-bold">{business.businessName}</p>
            <p className="text-xs text-muted-foreground">{t('panelTitle')}</p>
          </div>
        </div>
        <nav aria-label={t('nav.menu')} className="grid gap-1">
          {items.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={key}
              to={to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-[#3a3129] hover:bg-surface-2'
                }`
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {t(`nav.${key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-border px-2 pt-3">
          <div
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e9d8c4] font-heading font-bold text-[#7a3d1e]"
          >
            {(displayName ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] leading-tight font-semibold">{displayName}</p>
            <p className="text-xs text-muted-foreground">{t(`roles.${business.role}`)}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            title={t('logout')}
            aria-label={t('logout')}
            className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <LogOutIcon className="size-5" />
          </button>
        </div>
      </aside>

      {/* ---------- Phone top bar ---------- */}
      <header className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-border bg-background/92 px-4 py-2.5 backdrop-blur min-[900px]:hidden">
        <Logo className="size-8.5 rounded-[10px] text-base" />
        <p className="min-w-0 flex-1 truncate text-[14.5px] font-bold">{business.businessName}</p>
        <button
          type="button"
          onClick={logout}
          aria-label={t('logout')}
          className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          <LogOutIcon className="size-5" />
        </button>
      </header>

      <main className="px-4 pt-4 pb-28 min-[900px]:ml-62 min-[900px]:max-w-[1180px] min-[900px]:px-8 min-[900px]:pt-7">
        <Outlet />
      </main>

      {/* ---------- Phone bottom tabs ---------- */}
      <nav
        aria-label={t('nav.menu')}
        className="fixed inset-x-0 bottom-0 z-10 grid auto-cols-fr grid-flow-col border-t border-border bg-surface px-1.5 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] min-[900px]:hidden"
      >
        {items.map(({ to, key, icon: Icon }) => (
          <NavLink
            key={key}
            to={to}
            className={({ isActive }) =>
              `grid min-h-[54px] content-center justify-items-center gap-0.5 rounded-xl text-[11px] font-semibold ${
                isActive
                  ? 'bg-surface-2 text-foreground [&_svg]:text-brand'
                  : 'text-muted-foreground'
              }`
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            {t(`nav.${key}`)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
