import { afterEach, describe, expect, it, vi } from 'vitest'

import { SUPABASE_URL } from '@/lib/env'
import { createBooking } from './api'

/* createBooking talks to the create-booking Edge Function — fetch is faked here. */
const input = {
  businessId: 'biz-1',
  serviceId: 'svc-1',
  staffId: 'st-1',
  startsAt: '2026-11-15T05:00:00.000Z',
  name: 'Aziz',
  phone: '+998901234567',
  note: '',
  website: '',
}

afterEach(() => vi.unstubAllGlobals())

describe('createBooking', () => {
  it('POSTs the booking as JSON to the Edge Function and returns its answer', async () => {
    const answer = {
      ok: true,
      appointment: { id: 'a1', status: 'pending', starts_at: input.startsAt },
    }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(answer), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(createBooking({ ...input, captchaToken: 'tok' })).resolves.toEqual(answer)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/create-booking`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ ...input, captchaToken: 'tok' })
  })

  it('passes server error codes through (e.g. the time was just taken)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: false, code: 'SLOT_TAKEN' }), { status: 409 }),
      ),
    )
    await expect(createBooking(input)).resolves.toEqual({ ok: false, code: 'SLOT_TAKEN' })
  })

  it('a non-JSON answer becomes "unknown", a dropped connection "network"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Bad gateway', { status: 502 })),
    )
    await expect(createBooking(input)).resolves.toEqual({ ok: false, code: 'unknown' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(createBooking(input)).resolves.toEqual({ ok: false, code: 'network' })
  })
})
