import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addDaysToKey, localDayStartUtc, todayKey } from '@/lib/datetime'
import { createBooking, fetchSlots, type PublicSalon } from './api'
import { BookingWizard } from './BookingWizard'

/*
 * Customer booking flow (public page, no login): service → barber → time → details → done.
 * Free times and the create-booking call are faked; the real ones are covered by the
 * database tests (get_available_slots / create_booking) and the live check.
 */
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  fetchSlots: vi.fn(),
  createBooking: vi.fn(),
}))
// captcha off (it switches on only when a site key is configured)
vi.mock('@/lib/env', async (orig) => ({
  ...(await orig<typeof import('@/lib/env')>()),
  TURNSTILE_SITE_KEY: '',
}))

const TZ = 'Asia/Tashkent'
const tomorrow = addDaysToKey(todayKey(TZ), 1)
const at = (h: number) =>
  new Date(Date.parse(localDayStartUtc(tomorrow, TZ)) + h * 3_600_000).toISOString()

const salon: PublicSalon = {
  id: 'biz-1',
  name: 'Demo Barbershop',
  slug: 'demo',
  phone: '+998900000000',
  address: 'Toshkent',
  timezone: TZ,
  horizonDays: 30,
  coverPath: null,
  logoPath: null,
  services: [
    {
      id: 'svc-cut',
      name: 'Soch olish',
      description: null,
      durationMinutes: 30,
      priceUzs: 80000,
      photoPath: null,
    },
    {
      id: 'svc-beard',
      name: 'Soqol olish',
      description: null,
      durationMinutes: 20,
      priceUzs: 50000,
      photoPath: null,
    },
  ],
  staff: [
    {
      id: 'st-jasur',
      fullName: 'Jasur',
      bio: null,
      photoPath: null,
      serviceIds: ['svc-cut', 'svc-beard'],
    },
    { id: 'st-bobur', fullName: 'Bobur', bio: null, photoPath: null, serviceIds: ['svc-beard'] },
  ],
  gallery: [],
}

beforeEach(() => {
  vi.mocked(fetchSlots).mockReset()
  vi.mocked(createBooking).mockReset()
  // only tomorrow has free times: 10:00 and 10:30
  vi.mocked(fetchSlots).mockImplementation(async (_b, _svc, _st, date) =>
    date === tomorrow ? [at(10), at(10.5)] : [],
  )
  history.replaceState(null, '')
})

function renderWizard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <BookingWizard salon={salon} />
    </QueryClientProvider>,
  )
}

/** Steps 1–3: Soch olish → Jasur → tomorrow 10:00, then lands on the details form. */
async function pickUpToDetails(user: ReturnType<typeof userEvent.setup>) {
  const next = () => screen.getByRole('button', { name: 'Davom etish' })
  expect(next()).toBeDisabled() // nothing chosen yet
  await user.click(screen.getByRole('button', { name: /Soch olish/ }))
  await user.click(next())
  // Bobur doesn't do haircuts → not offered
  expect(screen.queryByRole('button', { name: /Bobur/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Jasur/ }))
  // nearest free time is found, so step 3 opens on that day
  expect(await screen.findByText(/Eng yaqin: ertaga 10:00/)).toBeInTheDocument()
  await user.click(next())
  await user.click(await screen.findByRole('button', { name: '10:00' }))
  await user.click(next())
  expect(screen.getByText('Ismingiz')).toBeInTheDocument()
}

describe('BookingWizard', () => {
  it('books: sends the right booking and shows the "pending" success screen', async () => {
    vi.mocked(createBooking).mockResolvedValue({
      ok: true,
      appointment: { id: 'a1', status: 'pending', starts_at: at(10) },
    })
    const user = userEvent.setup()
    renderWizard()
    await pickUpToDetails(user)
    await user.type(screen.getByPlaceholderText('Masalan: Aziz'), 'Aziz')
    await user.type(screen.getByPlaceholderText('90 123 45 67'), '901234567')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Band qilish' }))

    expect(await screen.findByText("So'rovingiz yuborildi!")).toBeInTheDocument()
    expect(createBooking).toHaveBeenCalledTimes(1)
    expect(vi.mocked(createBooking).mock.calls[0][0]).toEqual({
      businessId: 'biz-1',
      serviceId: 'svc-cut',
      staffId: 'st-jasur',
      startsAt: at(10),
      name: 'Aziz',
      phone: '+998901234567',
      note: '',
      website: '',
      tgInitData: undefined,
      captchaToken: undefined,
    })
  })

  it('does not send anything until name, phone and consent are valid', async () => {
    const user = userEvent.setup()
    renderWizard()
    await pickUpToDetails(user)
    await user.type(screen.getByPlaceholderText('90 123 45 67'), '90123')
    await user.click(screen.getByRole('button', { name: 'Band qilish' }))
    expect(screen.getByText('Ismingizni kiriting (kamida 2 ta harf).')).toBeInTheDocument()
    expect(screen.getByText(/Raqamni to'liq kiriting/)).toBeInTheDocument()
    expect(screen.getByText("Davom etish uchun rozilik belgisini qo'ying.")).toBeInTheDocument()
    expect(createBooking).not.toHaveBeenCalled()
    // consent text links to the privacy page
    expect(screen.getByRole('link', { name: 'Maxfiylik siyosati' })).toHaveAttribute(
      'href',
      '/privacy',
    )
  })

  it('time taken by someone else: explains it, keeps the form, offers other times', async () => {
    vi.mocked(createBooking).mockResolvedValue({ ok: false, code: 'SLOT_TAKEN' })
    const user = userEvent.setup()
    renderWizard()
    await pickUpToDetails(user)
    await user.type(screen.getByPlaceholderText('Masalan: Aziz'), 'Aziz')
    await user.type(screen.getByPlaceholderText('90 123 45 67'), '901234567')
    await user.click(screen.getByRole('checkbox'))
    // after the failure the server says 10:00 is gone
    vi.mocked(fetchSlots).mockImplementation(async (_b, _svc, _st, date) =>
      date === tomorrow ? [at(10.5)] : [],
    )
    await user.click(screen.getByRole('button', { name: 'Band qilish' }))

    const sheet = await screen.findByRole('dialog', { name: "Bu vaqt band bo'lib qoldi" })
    await waitFor(() => expect(sheet).toHaveTextContent('10:30'))
    expect(screen.getByPlaceholderText('Masalan: Aziz')).toHaveValue('Aziz')
  })

  it('shows the server error message for other failures', async () => {
    vi.mocked(createBooking).mockResolvedValue({ ok: false, code: 'TOO_MANY_BOOKINGS' })
    const user = userEvent.setup()
    renderWizard()
    await pickUpToDetails(user)
    await user.type(screen.getByPlaceholderText('Masalan: Aziz'), 'Aziz')
    await user.type(screen.getByPlaceholderText('90 123 45 67'), '901234567')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Band qilish' }))
    expect(await screen.findByText(/Bu raqam bilan faol yozilishlar juda ko'p/)).toBeInTheDocument()
  })
})
