import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BusinessContext } from '@/features/business/business-context'
import { supabase } from '@/lib/supabase'
import { SettingsPage } from './SettingsPage'

/*
 * Sozlamalar screen against a FAKE Supabase (src/test/setup.ts mocks the module).
 * We check what the owner sees AND exactly what would be sent to the database.
 */

type Call = { table: string; op: string; payload?: unknown; filters: unknown[][] }
let calls: Call[] = []
let saveError: { code: string; message: string } | null = null

const business = {
  name: 'Navbatly Demo Barbershop',
  phone: '+998900000000',
  address: 'Toshkent sh., Namuna ko‘chasi, 1-uy',
  slug: 'demo',
  timezone: 'Asia/Tashkent',
  slot_step_minutes: 15,
  booking_horizon_days: 30,
  min_notice_minutes: 60,
  max_active_bookings_per_phone: 3,
  auto_confirm: false,
}

function fakeFrom(table: string) {
  const call: Call = { table, op: 'select', filters: [] }
  calls.push(call)
  const b: Record<string, unknown> = {}
  for (const m of ['eq', 'gt', 'order', 'is', 'select']) {
    b[m] = vi.fn((...args: unknown[]) => (call.filters.push([m, ...args]), b))
  }
  b.update = vi.fn((payload: unknown) => ((call.op = 'update'), (call.payload = payload), b))
  b.single = vi.fn(async () => {
    if (call.op === 'update') {
      return saveError ? { data: null, error: saveError } : { data: { id: 'biz-1' }, error: null }
    }
    return { data: structuredClone(business), error: null }
  })
  // time_off list (salon closed days): none
  b.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
  return b
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/admin/settings', element: <SettingsPage /> },
      { path: '/admin/staff', element: <p>Ustalar sahifasi</p> },
    ],
    { initialEntries: ['/admin/settings'] },
  )
  render(
    <QueryClientProvider client={qc}>
      <BusinessContext.Provider
        value={{
          status: 'ready',
          role: 'owner',
          businessId: 'biz-1',
          businessName: 'Navbatly Demo Barbershop',
          businessSlug: 'demo',
          timezone: 'Asia/Tashkent',
          staffId: null,
          staffName: null,
        }}
      >
        <RouterProvider router={router} />
      </BusinessContext.Provider>
    </QueryClientProvider>,
  )
  return router
}

const saveButton = () => screen.getByRole('button', { name: "O'zgarishlarni saqlash" })
const updateCall = () => calls.find((c) => c.op === 'update')

beforeEach(() => {
  calls = []
  saveError = null
  vi.mocked(supabase.from).mockImplementation(fakeFrom as never)
})

describe('Sozlamalar screen', () => {
  it('shows the salon details, read-only link/timezone, rules and the auto-confirm note', async () => {
    renderPage()
    expect(await screen.findByLabelText('Salon nomi')).toHaveValue('Navbatly Demo Barbershop')
    expect(screen.getByLabelText('Telefon (ixtiyoriy)')).toHaveValue('90 000 00 00')
    expect(screen.getByLabelText('Bron havolasi')).toHaveValue(`${window.location.origin}/b/demo`)
    expect(screen.getByLabelText('Bron havolasi')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Vaqt mintaqasi')).toHaveValue('Toshkent (UTC+5)')
    expect(screen.getByLabelText('Eng kamida oldindan')).toHaveDisplayValue('1 soat')
    expect(
      screen.getByText('Mavjud kutilayotgan yozilishlar avtomatik tasdiqlanmaydi.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Salon yopiq kunlari' })).toBeInTheDocument()
    expect(saveButton()).toBeDisabled() // nothing changed yet

    // only this salon was requested; salon-wide days off = staff_id IS NULL
    const biz = calls.find((c) => c.table === 'businesses')
    expect(biz?.filters).toContainEqual(['eq', 'id', 'biz-1'])
    const off = calls.find((c) => c.table === 'time_off')
    expect(off?.filters).toContainEqual(['is', 'staff_id', null])
  })

  it('saves details + rules in one update, phone stored as +998…', async () => {
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText('Salon nomi')
    await user.clear(name)
    await user.type(name, '  Barber House ')
    const phone = screen.getByLabelText('Telefon (ixtiyoriy)')
    await user.clear(phone)
    await user.type(phone, '91-234 56 78')
    expect(phone).toHaveValue('91 234 56 78')
    await user.selectOptions(screen.getByLabelText('Vaqt qadami'), '30')
    await user.click(screen.getByRole('switch', { name: 'Avtomatik tasdiqlash' }))
    expect(screen.getByText("Saqlanmagan o'zgarishlar bor")).toBeInTheDocument()

    await user.click(saveButton())
    await waitFor(() => expect(saveButton()).toBeDisabled())

    const update = updateCall()
    expect(update?.table).toBe('businesses')
    expect(update?.filters).toContainEqual(['eq', 'id', 'biz-1'])
    expect(update?.payload).toEqual({
      name: 'Barber House', // trimmed
      phone: '+998912345678',
      address: 'Toshkent sh., Namuna ko‘chasi, 1-uy',
      slot_step_minutes: 30,
      booking_horizon_days: 30,
      min_notice_minutes: 60,
      max_active_bookings_per_phone: 3,
      auto_confirm: true,
    })
  })

  it('an emptied phone is saved as "no phone" (null)', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.clear(await screen.findByLabelText('Telefon (ixtiyoriy)'))
    await user.click(saveButton())
    await waitFor(() => expect(updateCall()).toBeDefined())
    expect(updateCall()?.payload).toMatchObject({ phone: null })
  })

  it('an incomplete phone shows a message and nothing is sent', async () => {
    const user = userEvent.setup()
    renderPage()
    const phone = await screen.findByLabelText('Telefon (ixtiyoriy)')
    await user.clear(phone)
    await user.type(phone, '90123')
    await user.click(saveButton())
    expect(await screen.findByText(/Telefon raqami to'liq bo'lsin/)).toBeInTheDocument()
    expect(updateCall()).toBeUndefined()
  })

  it('a database refusal is shown in Uzbek, changes stay on screen', async () => {
    saveError = { code: '42501', message: 'permission denied' }
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText('Manzil (ixtiyoriy)'), ' (2-qavat)')
    await user.click(saveButton())
    expect(await screen.findByRole('alert')).toHaveTextContent("Sizda bu amal uchun ruxsat yo'q.")
    expect(screen.getByLabelText('Manzil (ixtiyoriy)')).toHaveValue(
      'Toshkent sh., Namuna ko‘chasi, 1-uy (2-qavat)',
    )
  })

  it('asks before leaving with unsaved changes; "Qolish" keeps the page', async () => {
    const user = userEvent.setup()
    const router = renderPage()
    await user.type(await screen.findByLabelText('Salon nomi'), '!')
    await act(() => router.navigate('/admin/staff'))
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      "Sozlamalardagi o'zgarishlar saqlanmagan",
    )
    await user.click(screen.getByRole('button', { name: 'Qolish' }))
    expect(router.state.location.pathname).toBe('/admin/settings')
    expect(screen.getByLabelText('Salon nomi')).toHaveValue('Navbatly Demo Barbershop!')
  })
})
