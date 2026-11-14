/**
 * Public booking page data (no login). RLS lets visitors read only ACTIVE salons and their
 * active services / barbers / links / photos. Free times come from get_available_slots
 * (returns only times, never customer data). Booking goes through the create-booking
 * Edge Function (the database function itself is server-only).
 */
import { useQuery } from '@tanstack/react-query'

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/env'
import { supabase } from '@/lib/supabase'

export type PublicService = {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  priceUzs: number
  photoPath: string | null
}
export type PublicStaff = {
  id: string
  fullName: string
  bio: string | null
  photoPath: string | null
  serviceIds: string[]
}
export type PublicSalon = {
  id: string
  name: string
  slug: string
  phone: string | null
  address: string | null
  timezone: string
  horizonDays: number
  coverPath: string | null
  logoPath: string | null
  services: PublicService[]
  staff: PublicStaff[]
  gallery: { id: string; path: string }[]
}

export function usePublicSalon(slug: string) {
  return useQuery({
    queryKey: ['public-salon', slug],
    queryFn: async (): Promise<PublicSalon | null> => {
      const biz = await supabase
        .from('businesses')
        .select(
          'id, name, slug, phone, address, timezone, booking_horizon_days, cover_path, logo_path',
        )
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle()
      if (biz.error) throw biz.error
      if (!biz.data) return null
      const id = biz.data.id
      const [services, staff, links, gallery] = await Promise.all([
        supabase
          .from('services')
          .select('id, name, description, duration_minutes, price_uzs, photo_path')
          .eq('business_id', id)
          .eq('is_active', true)
          .order('sort_order')
          .order('name'),
        supabase
          .from('staff')
          .select('id, full_name, bio, photo_path')
          .eq('business_id', id)
          .eq('is_active', true)
          .order('sort_order')
          .order('full_name'),
        supabase.from('staff_services').select('staff_id, service_id').eq('business_id', id),
        supabase.from('salon_photos').select('id, path').eq('business_id', id).order('created_at'),
      ])
      for (const r of [services, staff, links, gallery]) if (r.error) throw r.error
      return {
        id,
        name: biz.data.name,
        slug: biz.data.slug,
        phone: biz.data.phone,
        address: biz.data.address,
        timezone: biz.data.timezone,
        horizonDays: biz.data.booking_horizon_days,
        coverPath: biz.data.cover_path,
        logoPath: biz.data.logo_path,
        services: (services.data ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          durationMinutes: s.duration_minutes,
          priceUzs: s.price_uzs,
          photoPath: s.photo_path,
        })),
        staff: (staff.data ?? []).map((s) => ({
          id: s.id,
          fullName: s.full_name,
          bio: s.bio,
          photoPath: s.photo_path,
          serviceIds: (links.data ?? [])
            .filter((l) => l.staff_id === s.id)
            .map((l) => l.service_id),
        })),
        gallery: gallery.data ?? [],
      }
    },
  })
}

/** Free start times (ISO timestamps) for one barber + service on one local date. */
export async function fetchSlots(
  businessId: string,
  serviceId: string,
  staffId: string,
  date: string,
) {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_business_id: businessId,
    p_service_id: serviceId,
    p_staff_id: staffId,
    p_date: date,
  })
  if (error) throw error
  return (data ?? []) as string[]
}

export const slotsKey = (b: string, svc: string, st: string, date: string) =>
  ['slots', b, svc, st, date] as const

export type BookingResult =
  | { ok: true; appointment: { id: string; status: 'pending' | 'confirmed'; starts_at: string } }
  | { ok: false; code: string }

export async function createBooking(input: {
  businessId: string
  serviceId: string
  staffId: string
  startsAt: string
  name: string
  phone: string
  note: string
  website: string // honeypot — always empty for real people
}): Promise<BookingResult> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(input),
    })
    const body = (await res.json().catch(() => null)) as BookingResult | null
    return body ?? { ok: false, code: 'unknown' }
  } catch {
    return { ok: false, code: 'network' }
  }
}
