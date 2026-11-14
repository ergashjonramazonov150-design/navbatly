import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Appointment } from '@/features/appointments/api'
import { BusinessContext } from '@/features/business/business-context'
import type { HoursRow, OffRow } from '@/features/calendar/api'
import type { StaffItem } from '@/features/staff/api'
import { addDaysToKey, isoWeekday, localDayStartUtc, todayKey } from '@/lib/datetime'
import { supabase } from '@/lib/supabase'
import { CalendarPage } from './CalendarPage'

/*
 * Kalendar (one day, barbers as columns) with faked lists. Status changes still go through
 * the real useSetAppointmentStatus → a fake supabase.rpc, so we see what would be sent.
 */
const TZ = 'Asia/Tashkent'
const today = todayKey(TZ)
const tomorrow = addDaysToKey(today, 1)
const at = (key: string, h: number) =>
  new Date(Date.parse(localDayStartUtc(key, TZ)) + h * 3_600_000).toISOString()
const wdToday = isoWeekday(localDayStartUtc(today, TZ), TZ)

const barber = (id: string, fullName: string, isActive = true): StaffItem => ({
  id,
  fullName,
  bio: null,
  photoPath: null,
  isActive,
  sortOrder: 0,
  serviceIds: ['cut'],
  hasLogin: false,
  todayHours: [],
})
const appt = (
  id: string,
  key: string,
  h: number,
  staffId: string,
  status: Appointment['status'],
  customerName: string,
): Appointment => ({
  id,
  startsAt: at(key, h),
  endsAt: at(key, h + 0.5),
  status,
  source: 'online',
  customerName,
  customerPhone: '+998901234567',
  customerNote: null,
  priceUzs: 80000,
  cancelReason: null,
  staffId,
  staffName: staffId === 'jasur' ? 'Jasur' : 'Bobur',
  serviceName: 'Soch olish',
})

let appointments: Appointment[] = []
let offRows: OffRow[] = []
const staff = [
  barber('jasur', 'Jasur'),
  barber('bobur', 'Bobur'),
  barber('old', 'Eski usta', false),
]
// Jasur: 09–13 + 14–20 (lunch 13–14). Bobur: same hours.
const hours: HoursRow[] = ['jasur', 'bobur'].flatMap((staffId) => [
  { staffId, weekday: wdToday, start: 9 * 60, end: 13 * 60 },
  { staffId, weekday: wdToday, start: 14 * 60, end: 20 * 60 },
])

vi.mock('@/features/appointments/api', async (orig) => ({
  ...(await orig<typeof import('@/features/appointments/api')>()),
  useAppointments: () => ({
    isPending: false,
    isError: false,
    data: appointments,
    dataUpdatedAt: 0,
  }),
}))
vi.mock('@/features/staff/api', () => ({
  useStaffList: () => ({ isPending: false, isError: false, data: staff }),
}))
vi.mock('@/features/services/api', () => ({
  useServices: () => ({
    isPending: false,
    isError: false,
    data: [
      {
        id: 'cut',
        name: 'Soch olish',
        description: null,
        photoPath: null,
        durationMinutes: 30,
        priceUzs: 80000,
        isActive: true,
        sortOrder: 0,
        staffCount: 2,
      },
    ],
  }),
}))
vi.mock('@/features/calendar/api', async (orig) => ({
  ...(await orig<typeof import('@/features/calendar/api')>()),
  useSalonHours: () => ({ isPending: false, isError: false, data: hours }),
  useSalonTimeOff: () => ({ isPending: false, isError: false, data: offRows }),
}))
vi.mock('@/features/booking/api', () => ({ fetchSlots: vi.fn(async () => []) }))

let rpcCalls: { fn: string; args: unknown }[] = []
beforeEach(() => {
  appointments = [
    appt('a1', today, 10, 'jasur', 'pending', 'Aziz Karimov'),
    appt('a2', today, 15, 'bobur', 'confirmed', 'Dilshod Rahimov'),
    appt('a3', today, 16, 'jasur', 'cancelled', 'Bekor Mijoz'),
    appt('a4', tomorrow, 11, 'jasur', 'confirmed', 'Ertangi Mijoz'),
  ]
  offRows = []
  rpcCalls = []
  Object.assign(supabase, {
    rpc: vi.fn(async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args })
      return { data: null, error: null }
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
          staffId: role === 'staff' ? 'jasur' : null,
          staffName: role === 'staff' ? 'Jasur' : null,
        }}
      >
        <MemoryRouter>
          <CalendarPage />
        </MemoryRouter>
      </BusinessContext.Provider>
    </QueryClientProvider>,
  )
}

describe('CalendarPage', () => {
  it('owner: active barbers as columns with today’s bookings; cancelled hidden', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 2, name: /^Bugun, / })).toBeInTheDocument()
    const columns = screen.getByRole('group', { name: 'Usta' }) // phone switcher = column list
    expect(
      within(columns)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Jasur', 'Bobur']) // the inactive barber has no column
    expect(screen.getByRole('button', { name: /Aziz Karimov/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dilshod Rahimov/ })).toBeInTheDocument()
    expect(screen.queryByText(/Bekor Mijoz/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Ertangi Mijoz/)).not.toBeInTheDocument()
    expect(screen.getAllByText('Tushlik')).toHaveLength(2) // 13–14 hatched in both columns
  })

  it('"Bekor qilinganlar" shows cancelled bookings; next day shows that day', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('checkbox', { name: 'Bekor qilinganlar' }))
    expect(screen.getByRole('button', { name: /Bekor Mijoz/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keyingi kun' }))
    expect(screen.getByRole('button', { name: /Ertangi Mijoz/ })).toBeInTheDocument()
    expect(screen.queryByText(/Aziz Karimov/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bugun' }))
    expect(screen.getByRole('button', { name: /Aziz Karimov/ })).toBeInTheDocument()
  })

  it('a barber’s day off is hatched as "Dam olish"', () => {
    offRows = [{ staffId: 'bobur', startsAt: at(today, 0), endsAt: at(today, 24), reason: null }]
    renderPage()
    expect(screen.getByText('Dam olish')).toBeInTheDocument()
    expect(screen.getAllByText('Tushlik')).toHaveLength(1) // only Jasur works
  })

  it('tapping a pending booking opens details; "Tasdiqlash" confirms it', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Aziz Karimov/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Aziz Karimov' })
    expect(within(dialog).getByText(/Soch olish · Jasur/)).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: '+998 90 123 45 67' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Tasdiqlash' }))
    await waitFor(() => expect(rpcCalls).toHaveLength(1))
    expect(rpcCalls[0]).toEqual({
      fn: 'set_appointment_status',
      args: { p_appointment_id: 'a1', p_status: 'confirmed', p_cancel_reason: undefined },
    })
  })

  it('"Yangi yozilish" opens the manual booking dialog', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Yangi yozilish' }))
    expect(await screen.findByRole('dialog', { name: 'Yangi yozilish' })).toBeInTheDocument()
  })

  it('barber login: only his own column', () => {
    renderPage('staff')
    expect(screen.queryByRole('group', { name: 'Usta' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aziz Karimov/ })).toBeInTheDocument()
    expect(screen.queryByText(/Dilshod Rahimov/)).not.toBeInTheDocument()
  })
})
