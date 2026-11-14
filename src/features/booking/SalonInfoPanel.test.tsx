import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PublicSalon } from './api'
import { SalonInfoPanel } from './SalonInfoPanel'

// opening hours come from get_salon_hours (migration 11): Mon–Sat 09–20, Sunday closed
vi.mock('./api', () => ({
  useSalonOpeningHours: () => ({
    data: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: '09:00', closes: '20:00' })),
  }),
}))

const salon: PublicSalon = {
  id: 'biz-1',
  name: 'Demo Barbershop',
  slug: 'demo',
  phone: '+998901234567',
  address: 'Toshkent, Namuna ko‘chasi',
  timezone: 'Asia/Tashkent',
  horizonDays: 30,
  coverPath: null,
  logoPath: null,
  services: [],
  staff: [
    { id: 's1', fullName: 'Jasur', bio: '8 yillik tajriba', photoPath: null, serviceIds: [] },
    { id: 's2', fullName: 'Bobur', bio: null, photoPath: null, serviceIds: [] },
  ],
  gallery: [
    { id: 'g1', path: 'biz-1/gallery/a.webp' },
    { id: 'g2', path: 'biz-1/gallery/b.webp' },
  ],
}

describe('SalonInfoPanel (desktop left column)', () => {
  it('shows name, address, weekly hours with today marked, call link and barbers', () => {
    render(<SalonInfoPanel salon={salon} todayWeekday={6} hasCover={false} onOpenPhoto={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Demo Barbershop' })).toBeInTheDocument()
    expect(screen.getByText('Toshkent, Namuna ko‘chasi')).toBeInTheDocument()

    const hours = screen.getByRole('region', { name: 'Ish vaqti' })
    expect(within(hours).getAllByText('09:00 – 20:00')).toHaveLength(6)
    expect(within(hours).getByText('Dam olish kuni')).toBeInTheDocument() // Sunday
    expect(within(hours).getByText('Shanba').parentElement).toHaveTextContent('Bugun')

    expect(screen.getByRole('link', { name: /\+998 90 123 45 67/ })).toHaveAttribute(
      'href',
      'tel:+998901234567',
    )
    const barbers = screen.getByRole('region', { name: 'Ustalar' })
    expect(within(barbers).getByText('Jasur')).toBeInTheDocument()
    expect(within(barbers).getByText('8 yillik tajriba')).toBeInTheDocument()
    expect(within(barbers).getByText('Bobur')).toBeInTheDocument()
  })

  it('gallery photos open the viewer at the clicked photo', async () => {
    const onOpenPhoto = vi.fn()
    render(<SalonInfoPanel salon={salon} todayWeekday={1} hasCover onOpenPhoto={onOpenPhoto} />)
    await userEvent.setup().click(screen.getByRole('button', { name: '2-rasm — kattalashtirish' }))
    expect(onOpenPhoto).toHaveBeenCalledWith(1)
  })
})
