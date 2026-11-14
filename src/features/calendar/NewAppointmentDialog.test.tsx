import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Appointment } from '@/features/appointments/api'
import { fetchSlots } from '@/features/booking/api'
import type { ServiceItem } from '@/features/services/api'
import type { StaffItem } from '@/features/staff/api'
import { addDaysToKey, isoWeekday, localDayStartUtc, todayKey } from '@/lib/datetime'
import { supabase } from '@/lib/supabase'
import type { HoursRow } from './api'
import { NewAppointmentDialog } from './NewAppointmentDialog'

/*
 * Manual booking («Yangi yozilish») against fake free times + a fake database call.
 * The database itself re-checks everything (DB test 02: admin_create_appointment).
 */
vi.mock('@/features/booking/api', () => ({ fetchSlots: vi.fn() }))

const TZ = 'Asia/Tashkent'
const day = addDaysToKey(todayKey(TZ), 1) // tomorrow: never "in the past"
const at = (h: number) =>
  new Date(Date.parse(localDayStartUtc(day, TZ)) + h * 3_600_000).toISOString()

const svc = (id: string, name: string, durationMinutes: number): ServiceItem => ({
  id,
  name,
  description: null,
  photoPath: null,
  durationMinutes,
  priceUzs: 80000,
  isActive: true,
  sortOrder: 0,
  staffCount: 1,
})
const barber = (id: string, fullName: string, serviceIds: string[]): StaffItem => ({
  id,
  fullName,
  bio: null,
  photoPath: null,
  isActive: true,
  sortOrder: 0,
  serviceIds,
  hasLogin: false,
  todayHours: [],
})
const services = [svc('cut', 'Soch olish', 30), svc('beard', 'Soqol olish', 20)]
const staff = [barber('jasur', 'Jasur', ['cut', 'beard']), barber('bobur', 'Bobur', ['beard'])]
const weekday = isoWeekday(localDayStartUtc(day, TZ), TZ)
const hours: HoursRow[] = [{ staffId: 'jasur', weekday, start: 9 * 60, end: 20 * 60 }]
// Jasur already has 15:00–15:30 tomorrow
const existing = [
  { id: 'x', staffId: 'jasur', status: 'confirmed', startsAt: at(15), endsAt: at(15.5) },
] as Appointment[]

let rpcCalls: { fn: string; args: Record<string, unknown> }[] = []
let rpcError: { code: string; message: string } | null = null

beforeEach(() => {
  rpcCalls = []
  rpcError = null
  vi.mocked(fetchSlots)
    .mockReset()
    .mockResolvedValue([at(10), at(10.5)])
  Object.assign(supabase, {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args })
      return { data: null, error: rpcError }
    }),
  })
})

function renderDialog(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <NewAppointmentDialog
        businessId="biz-1"
        timezone={TZ}
        today={todayKey(TZ)}
        services={services}
        staff={staff}
        hours={hours}
        appointments={existing}
        initial={{ day }}
        onClose={onClose}
      />
    </QueryClientProvider>,
  )
  return onClose
}

async function fillCustomer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('Ism'), 'Aziz')
  await user.type(screen.getByPlaceholderText('90 123 45 67'), '901234567')
}

describe('NewAppointmentDialog (Yangi yozilish)', () => {
  it('books a free time through admin_create_appointment and closes', async () => {
    const user = userEvent.setup()
    const onClose = renderDialog()
    await user.click(await screen.findByRole('button', { name: '10:30' }))
    await fillCustomer(user)
    await user.click(screen.getByRole('button', { name: "Qo'shish" }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(rpcCalls).toEqual([
      {
        fn: 'admin_create_appointment',
        args: {
          p_service_id: 'cut',
          p_staff_id: 'jasur',
          p_starts_at: at(10.5),
          p_customer_name: 'Aziz',
          p_customer_phone: '+998901234567',
          p_customer_note: undefined,
        },
      },
    ])
  })

  it('offers only barbers who do the chosen service', async () => {
    const user = userEvent.setup()
    renderDialog()
    const [serviceSelect, staffSelect] = screen.getAllByRole('combobox')
    expect([...staffSelect.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Jasur'])
    await user.selectOptions(serviceSelect, 'beard')
    expect([...staffSelect.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Jasur',
      'Bobur',
    ])
  })

  it('asks for a time and checks name / phone before saving', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('button', { name: '10:00' })
    await user.click(screen.getByRole('button', { name: "Qo'shish" }))
    expect(screen.getByRole('alert')).toHaveTextContent('Vaqtni tanlang.')
    await user.click(screen.getByRole('button', { name: '10:00' }))
    await user.click(screen.getByRole('button', { name: "Qo'shish" }))
    expect(screen.getByText('Ismni kiriting (kamida 2 harf).')).toBeInTheDocument()
    expect(screen.getByText("Telefon raqami to'liq bo'lsin: 9 ta raqam.")).toBeInTheDocument()
    expect(rpcCalls).toHaveLength(0)
  })

  it('"Boshqa vaqt": blocks a time that overlaps an existing booking', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('checkbox', { name: /Boshqa vaqt/ }))
    await user.type(screen.getByLabelText('Vaqt'), '15:15')
    expect(screen.getByRole('alert')).toHaveTextContent('Bu vaqtda Jasurda boshqa yozilish bor')
    expect(screen.getByRole('button', { name: "Qo'shish" })).toBeDisabled()
  })

  it('"Boshqa vaqt" outside working hours: warns but still allows it', async () => {
    const user = userEvent.setup()
    const onClose = renderDialog()
    await user.click(screen.getByRole('checkbox', { name: /Boshqa vaqt/ }))
    await user.type(screen.getByLabelText('Vaqt'), '21:00')
    expect(screen.getByText(/ish vaqtidan tashqarida/)).toBeInTheDocument()
    await fillCustomer(user)
    await user.click(screen.getByRole('button', { name: "Qo'shish" }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(rpcCalls[0].args.p_starts_at).toBe(at(21))
  })

  it('shows the database’s answer when the time was just taken', async () => {
    rpcError = { code: 'P0001', message: 'SLOT_TAKEN' }
    const user = userEvent.setup()
    const onClose = renderDialog()
    await user.click(await screen.findByRole('button', { name: '10:00' }))
    await fillCustomer(user)
    await user.click(screen.getByRole('button', { name: "Qo'shish" }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
