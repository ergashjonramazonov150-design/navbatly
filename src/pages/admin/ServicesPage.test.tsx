import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BusinessContext } from '@/features/business/business-context'
import { supabase } from '@/lib/supabase'
import { ServicesPage } from './ServicesPage'

/*
 * Services screen against a FAKE Supabase (src/test/setup.ts mocks the module).
 * We check what the user sees AND exactly what would be sent to the database.
 */

const NBSP = ' '
type Call = { table: string; op: string; payload?: unknown; filters: unknown[][] }
let calls: Call[] = []
let futureBookings = 0
let saveError: { code: string; message: string } | null = null

const rows = [
  {
    id: 's1',
    name: 'Soch olish',
    description: 'Yuvish va ukladka bilan',
    duration_minutes: 30,
    price_uzs: 80000,
    is_active: true,
    sort_order: 1,
    staff_services: [{ count: 3 }],
  },
  {
    id: 's2',
    name: 'Ukladka',
    description: null,
    duration_minutes: 20,
    price_uzs: 40000,
    is_active: false,
    sort_order: 2,
    staff_services: [{ count: 0 }],
  },
]

function fakeFrom(table: string) {
  const call: Call = { table, op: 'select', filters: [] }
  calls.push(call)
  const b: Record<string, unknown> = {}
  for (const m of ['eq', 'order', 'in', 'gte']) {
    b[m] = vi.fn((...args: unknown[]) => (call.filters.push([m, ...args]), b))
  }
  b.select = vi.fn((_cols: string, opts?: { head?: boolean }) => {
    if (opts?.head) call.op = 'count'
    return b
  })
  b.update = vi.fn((payload: unknown) => ((call.op = 'update'), (call.payload = payload), b))
  b.insert = vi.fn((payload: unknown) => ((call.op = 'insert'), (call.payload = payload), b))
  b.single = vi.fn(async () =>
    saveError ? { data: null, error: saveError } : { data: { id: 'new' }, error: null },
  )
  b.then = (resolve: (v: unknown) => void) =>
    resolve(
      call.op === 'count'
        ? { count: futureBookings, error: null }
        : { data: structuredClone(rows), error: null },
    )
  return b
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <BusinessContext.Provider
        value={{
          status: 'ready',
          role: 'owner',
          businessId: 'biz-1',
          businessName: 'Demo',
          businessSlug: 'demo',
          staffId: null,
          staffName: null,
        }}
      >
        <ServicesPage />
      </BusinessContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  calls = []
  futureBookings = 0
  saveError = null
  vi.mocked(supabase.from).mockImplementation(fakeFrom as never)
})

describe('Xizmatlar screen', () => {
  it('lists services with formatted prices, staff count, inactive badge and no-barber warning', async () => {
    renderPage()
    expect(await screen.findByText('Soch olish')).toBeInTheDocument()
    // (Testing Library turns NBSP into normal spaces when matching text)
    expect(screen.getAllByText("80 000 so'm").length).toBeGreaterThan(0)
    expect(screen.getByText('3 ta usta')).toBeInTheDocument()
    expect(screen.getByText('Nofaol')).toBeInTheDocument()
    expect(screen.getByText(/Hech bir usta biriktirilmagan/)).toBeInTheDocument()
    // only this salon's services were requested
    expect(calls[0].filters).toContainEqual(['eq', 'business_id', 'biz-1'])
  })

  it('creates a service: price typed as digits is shown "80 000" and saved as 80000', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Yangi xizmat' }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText('Nomi'), '  Soqol olish ')
    await user.selectOptions(within(dialog).getByLabelText('Davomiyligi'), '20')
    const price = within(dialog).getByLabelText("Narxi (so'm)")
    await user.type(price, '50000')
    expect(price).toHaveValue(`50${NBSP}000`)
    expect(within(dialog).getByText("50 000 so'm")).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const insert = calls.find((c) => c.op === 'insert')
    expect(insert?.payload).toEqual({
      name: 'Soqol olish', // trimmed
      description: null,
      duration_minutes: 20,
      price_uzs: 50000,
      is_active: true,
      business_id: 'biz-1',
      sort_order: 3, // after the existing max (2)
    })
  })

  it('shows Uzbek validation messages and does not save', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Yangi xizmat' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))

    expect(await within(dialog).findByText('Nomini kiriting (kamida 2 harf).')).toBeInTheDocument()
    expect(within(dialog).getByText('Narxni kiriting (faqat raqamlar).')).toBeInTheDocument()
    expect(calls.some((c) => c.op === 'insert')).toBe(false)
  })

  it('edits an existing service: sends only allowed columns, filtered by id', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Soch olish/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Xizmatni tahrirlash' })
    expect(within(dialog).getByText(/eski yozilishlar eski narxda qoladi/)).toBeInTheDocument()

    const price = within(dialog).getByLabelText("Narxi (so'm)")
    await user.clear(price)
    await user.type(price, '90000')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const update = calls.find((c) => c.op === 'update')
    expect(update?.payload).toEqual({
      name: 'Soch olish',
      description: 'Yuvish va ukladka bilan',
      duration_minutes: 30,
      price_uzs: 90000,
      is_active: true,
    })
    expect(update?.filters).toContainEqual(['eq', 'id', 's1'])
  })

  it('a database error is shown in Uzbek, dialog stays open', async () => {
    saveError = { code: '23514', message: 'new row violates check constraint' }
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Soch olish/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Ma'lumot noto'g'ri. Maydonlarni tekshiring.",
    )
    expect(screen.queryByText(/check constraint/)).not.toBeInTheDocument()
  })

  it('deactivating warns about FUTURE bookings, and only then saves', async () => {
    futureBookings = 3
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('switch', { name: 'Soch olish — faol' }))

    const dialog = await screen.findByRole('dialog', { name: '«Soch olish» ni nofaol qilasizmi?' })
    expect(await within(dialog).findByText(/3 ta kelgusi yozilish bor/)).toBeInTheDocument()
    expect(calls.some((c) => c.op === 'update')).toBe(false) // nothing saved yet

    // the count only looks at future, active bookings of this service
    const count = calls.find((c) => c.op === 'count')
    expect(count?.table).toBe('appointments')
    expect(count?.filters).toContainEqual(['eq', 'service_id', 's1'])
    expect(count?.filters).toContainEqual(['in', 'status', ['pending', 'confirmed']])

    await user.click(within(dialog).getByRole('button', { name: 'Nofaol qilish' }))
    await waitFor(() =>
      expect(calls.find((c) => c.op === 'update')?.payload).toEqual({ is_active: false }),
    )
  })

  it('cancelling the deactivate dialog changes nothing', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('switch', { name: 'Soch olish — faol' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Bekor' }))
    expect(calls.some((c) => c.op === 'update')).toBe(false)
  })

  it('re-activating needs no confirmation', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('switch', { name: 'Ukladka — faol' }))
    await waitFor(() =>
      expect(calls.find((c) => c.op === 'update')?.payload).toEqual({ is_active: true }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
