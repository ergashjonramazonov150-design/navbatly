import { describe, expect, it } from 'vitest'

import { customerMessage, salonMessage, type BookingInfo } from './bookingMessages.ts'

const booking: BookingInfo = {
  customer_name: 'Aziz <b>',
  customer_phone: '+998901234567',
  customer_note: null,
  starts_at: '2026-11-15T05:00:00.000Z', // 10:00 in Tashkent (UTC+5), a Sunday
  status: 'pending',
  price_uzs: 80000,
  services: { name: 'Soch olish', duration_minutes: 30 },
  staff: { full_name: 'Jasur' },
  businesses: {
    name: 'Demo & Co',
    timezone: 'Asia/Tashkent',
    phone: '+998900000000',
    address: 'Namuna ko‘chasi, 1-uy',
  },
}

describe('customerMessage (Mini App customer’s own chat)', () => {
  it('has salon, service, barber, date/time and status', () => {
    const text = customerMessage(booking)
    expect(text).toContain("So'rovingiz yuborildi — Demo &amp; Co")
    expect(text).toContain("Soch olish (30 daq) — 80 000 so'm")
    expect(text).toContain('Usta: Jasur')
    expect(text).toContain('15-noyabr, yakshanba, 10:00')
    expect(text).toContain('salon tasdiqlashi kutilmoqda')
    expect(text).toContain('📍 Namuna ko‘chasi, 1-uy')
    expect(text).toContain('📞 +998 90 000 00 00')
  })

  it('says "Siz yozildingiz" when the salon auto-confirms', () => {
    const text = customerMessage({ ...booking, status: 'confirmed' })
    expect(text).toContain('Siz yozildingiz')
    expect(text).toContain('Holat: tasdiqlangan')
  })

  it('never repeats the customer’s own phone or name back (nothing private to leak)', () => {
    const text = customerMessage(booking)
    expect(text).not.toContain('901234567')
    expect(text).not.toContain('Aziz')
  })

  it('skips address / phone lines the salon has not filled in', () => {
    const text = customerMessage({
      ...booking,
      businesses: { ...booking.businesses!, phone: null, address: null },
    })
    expect(text).not.toContain('📍')
    expect(text).not.toContain('📞')
  })
})

describe('salonMessage', () => {
  it('escapes customer text and marks Mini App bookings', () => {
    const text = salonMessage({ ...booking, customer_note: '<i>kech</i>' }, true)
    expect(text).toContain('Aziz &lt;b&gt;')
    expect(text).toContain('💬 &lt;i&gt;kech&lt;/i&gt;')
    expect(text).toContain('📱 Telegram orqali yozildi')
    expect(salonMessage(booking, false)).not.toContain('Telegram orqali')
  })
})
