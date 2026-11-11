import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session, User } from '@supabase/supabase-js'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { buildAdminRoutes } from '@/app/router'
import { AuthContext, type AuthState } from '@/features/auth/auth-context'
import { RequireBusiness } from '@/features/auth/guards'
import { BusinessContext, type BusinessContextValue } from '@/features/business/business-context'

/*
 * Guard tests: real route tree + real guards + real layout.
 * Only the two "inputs" are faked: who is logged in, and what their salon context is.
 */

const user = { id: 'user-1' } as User
const signedIn: AuthState = { status: 'signedIn', user, session: { user } as Session }

const ready = (role: 'owner' | 'staff'): BusinessContextValue => ({
  status: 'ready',
  role,
  businessId: 'biz-1',
  businessName: 'Navbatly Demo Barbershop',
  businessSlug: 'demo',
  staffId: role === 'staff' ? 'staff-1' : null,
  staffName: role === 'staff' ? 'Jasur' : null,
})

function renderAt(path: string, auth: AuthState, business: BusinessContextValue) {
  const signOut = vi.fn(async () => {})
  const gate = (
    <BusinessContext.Provider value={business}>
      <RequireBusiness />
    </BusinessContext.Provider>
  )
  const router = createMemoryRouter(buildAdminRoutes(gate), { initialEntries: [path] })
  render(
    <AuthContext.Provider value={{ state: auth, recovery: false, signOut }}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return { router, signOut }
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name })

describe('RequireAuth', () => {
  it('logged-out user opening /admin/appointments lands on the login page', async () => {
    const { router } = renderAt('/admin/appointments', { status: 'signedOut' }, ready('owner'))
    expect(await heading('Boshqaruv paneli')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/login')
    // remembers where they wanted to go
    expect(router.state.location.state).toEqual({ from: '/admin/appointments' })
  })

  it('shows a loader while the session is being restored', () => {
    renderAt('/admin/appointments', { status: 'loading' }, ready('owner'))
    expect(screen.getByRole('status')).toHaveTextContent('Yuklanmoqda')
  })

  it('logged-in user opening /admin/login is sent to the panel', async () => {
    const { router } = renderAt('/admin/login', signedIn, ready('owner'))
    expect(await heading('Yozilishlar')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/appointments')
  })

  it('/admin redirects to /admin/appointments', async () => {
    const { router } = renderAt('/admin', signedIn, ready('owner'))
    expect(await heading('Yozilishlar')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/appointments')
  })
})

describe('roles', () => {
  it('owner sees all 5 sections and can open owner-only pages', async () => {
    renderAt('/admin/services', signedIn, ready('owner'))
    expect(await heading('Xizmatlar')).toBeInTheDocument()
    const nav = screen.getAllByRole('navigation', { name: 'Asosiy menyu' })[0]
    for (const label of ['Yozilishlar', 'Kalendar', 'Xizmatlar', 'Ustalar', 'Sozlamalar']) {
      expect(nav).toHaveTextContent(label)
    }
  })

  it('staff sees only Yozilishlar + Kalendar', async () => {
    renderAt('/admin/appointments', signedIn, ready('staff'))
    await heading('Yozilishlar')
    const nav = screen.getAllByRole('navigation', { name: 'Asosiy menyu' })[0]
    expect(nav).toHaveTextContent('Kalendar')
    expect(nav).not.toHaveTextContent('Xizmatlar')
    expect(nav).not.toHaveTextContent('Ustalar')
    expect(nav).not.toHaveTextContent('Sozlamalar')
  })

  it.each(['/admin/services', '/admin/staff', '/admin/settings'])(
    'staff typing the owner-only URL %s is redirected to their appointments',
    async (path) => {
      const { router } = renderAt(path, signedIn, ready('staff'))
      expect(await heading('Yozilishlar')).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/admin/appointments')
    },
  )

  it('unknown admin URL falls back to appointments', async () => {
    const { router } = renderAt('/admin/nope', signedIn, ready('owner'))
    await heading('Yozilishlar')
    expect(router.state.location.pathname).toBe('/admin/appointments')
  })
})

describe('RequireBusiness', () => {
  it('INACTIVE staff profile: clear message + logout, no admin shell', async () => {
    const { signOut } = renderAt('/admin/appointments', signedIn, { status: 'inactive' })
    expect(await heading('Hisobingiz vaqtincha faolsizlantirilgan')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Asosiy menyu' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Chiqish' }))
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('inactive user cannot reach owner pages either', async () => {
    renderAt('/admin/settings', signedIn, { status: 'inactive' })
    expect(await heading('Hisobingiz vaqtincha faolsizlantirilgan')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sozlamalar' })).not.toBeInTheDocument()
  })

  it('login without a salon: explains and offers logout', async () => {
    renderAt('/admin/appointments', signedIn, { status: 'no-business' })
    expect(await heading('Hisobingiz hech qaysi salonga ulanmagan')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chiqish' })).toBeInTheDocument()
  })

  it('load error: retry button calls retry()', async () => {
    const retry = vi.fn()
    renderAt('/admin/appointments', signedIn, { status: 'error', retry })
    await heading("Ma'lumotlarni yuklab bo'lmadi")
    await userEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
