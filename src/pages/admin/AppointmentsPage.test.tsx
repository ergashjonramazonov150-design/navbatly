import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BusinessContext } from '@/features/business/business-context'
import { addDaysToKey, localDayStartUtc, todayKey } from '@/lib/datetime'
import { supabase } from '@/lib/supabase'
import { AppointmentsPage } from './AppointmentsPage'

/*
 * Yozilishlar list against a FAKE Supabase: what the owner / barber sees, and that
 * confirm / cancel go through set_appointment_status with the right values.
 * Staff / services / hours lists are only needed for "Yangi yozilish" → stubbed.
 */
vi.mock('@/features/staff/api', () => ({ useStaffList: () => ({ data: [] }) }))
vi.mock('@/features/services/api', () => ({ useServices: () => ({ data: [] }) }))
vi.mock('@/features/calendar/api', () => ({ useSalonHours: () => ({ data: [] }) }))

const TZ = 'Asia/Tashkent'
// tomorrow, so the bookings are always in the future (no "O'tgan" whatever the test time)
const tomorrow = addDaysToKey(todayKey(TZ), 1)
const at = (h: number) =>
  new Date(Date.parse(localDayStartUtc(tomorrow, TZ)) + h * 3_600_000).toISOString()

const row = (id: string, h: number, status: string, name: string, staff: string) => ({
  id,
  starts_at: at(h),
  ends_at: at(h + 0.5),
  status,
  source: 'online',
  customer_name: name,
  customer_phone: '+998901234567',
  customer_note: null,
  price_uzs: 80000,
  cancel_reason: null,
  staff_id: `st-${staff}`,
  services: { name: 'Soch olish' },
  staff: { full_name: staff },
})

let rows: unknown[] = []
let rpcCalls: { fn: string; args: unknown }[] = []
let rpcError: { code: string; message: string } | null = null

beforeEach(() => {
  rows = [
    row('a1', 10, 'pending', 'Aziz Karimov', 'Jasur'),
    row('a2', 11, 'confirmed', 'Dilshod Rahimov', 'Bobur'),
  ]
  rpcCalls = []
  rpcError = null
  vi.mocked(supabase.from).mockImplementation((() => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'gte', 'lt', 'order', 'limit']) b[m] = vi.fn(() => b)
    b.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null })
    return b
  }) as never)
  Object.assign(supabase, {
    rpc: vi.fn(async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args })
      return { data: null, error: rpcError }
    }),
  })
})

function renderPage(role: 'owner' | 'staff' = 'owner') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <BusinessContext.Provider
        value={{
          status: 'ready',
          role,
          businessId: 'biz-1',
          businessName: 'Demo',
          businessSlug: 'demo',
          timezone: TZ,
          staffId: role === 'staff' ? 'st-Jasur' : null,
          staffName: role === 'staff' ? 'Jasur' : null,
        }}
      >
        <MemoryRouter>
          <AppointmentsPage />
        </MemoryRouter>
      </BusinessContext.Provider>
    </QueryClientProvider>,
  )
}

describe('AppointmentsPage', () => {
  it('shows the pending banner and tomorrow’s bookings with barber names (owner)', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('1 ta yozilish tasdiqlashingizni kutmoqda.')).toBeInTheDocument()
    // default filter is "Bugun" → nothing today
    expect(screen.getByText("Yozilishlar yo'q")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ertaga' }))
    expect(screen.getByText('Aziz Karimov')).toBeInTheDocument()
    expect(screen.getByText('Dilshod Rahimov')).toBeInTheDocument()
    // owner sees the barber on the card
    const card = screen.getByText('Aziz Karimov').closest('article')!
    expect(within(card).getByText('Jasur')).toBeInTheDocument()
    expect(screen.getByText('10:00')).toBeInTheDocument()
    // two barbers → barber filter is shown
    expect(screen.getByRole('combobox', { name: "Usta bo'yicha" })).toBeInTheDocument()
  })

  it('search looks through all days, by name or phone digits', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('1 ta yozilish tasdiqlashingizni kutmoqda.')
    await user.type(screen.getByRole('searchbox'), 'dilshod')
    expect(screen.getByText('Dilshod Rahimov')).toBeInTheDocument()
    expect(screen.queryByText('Aziz Karimov')).not.toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'xyz')
    expect(screen.getByText('«xyz» topilmadi')).toBeInTheDocument()
  })

  it('"Tasdiqlash" calls set_appointment_status with confirmed', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: "Ko'rish" })) // pending only
    const card = screen.getByText('Aziz Karimov').closest('article')!
    expect(within(card).getByText('Kutilmoqda')).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Tasdiqlash' }))
    await waitFor(() => expect(rpcCalls).toHaveLength(1))
    expect(rpcCalls[0]).toEqual({
      fn: 'set_appointment_status',
      args: { p_appointment_id: 'a1', p_status: 'confirmed', p_cancel_reason: undefined },
    })
  })

  it('cancel asks for an optional reason and sends it', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Ertaga' }))
    const card = screen.getByText('Dilshod Rahimov').closest('article')!
    // confirmed booking: no confirm button, only cancel
    expect(within(card).queryByRole('button', { name: 'Tasdiqlash' })).not.toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Bekor qilish' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Usta ishlay olmaydi' }))
    await user.click(within(dialog).getByRole('button', { name: 'Bekor qilish' }))
    await waitFor(() => expect(rpcCalls).toHaveLength(1))
    expect(rpcCalls[0].args).toEqual({
      p_appointment_id: 'a2',
      p_status: 'cancelled',
      p_cancel_reason: 'Usta ishlay olmaydi',
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps the dialog open when the database refuses', async () => {
    rpcError = { code: 'P0001', message: 'INVALID_STATUS_TRANSITION' }
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Ertaga' }))
    const card = screen.getByText('Dilshod Rahimov').closest('article')!
    await user.click(within(card).getByRole('button', { name: 'Bekor qilish' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Bekor qilish' }))
    await waitFor(() => expect(rpcCalls).toHaveLength(1))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('barber login: explains the limited view and hides barber names', async () => {
    rows = [row('a1', 10, 'pending', 'Aziz Karimov', 'Jasur')]
    const user = userEvent.setup()
    renderPage('staff')
    expect(
      await screen.findByText("Siz faqat o'zingizga yozilgan mijozlarni ko'rasiz va boshqarasiz."),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ertaga' }))
    const card = screen.getByText('Aziz Karimov').closest('article')!
    expect(within(card).queryByText('Jasur')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
