/**
 * Day calendar + manual booking (M5). Members of the salon can read working hours and days
 * off (RLS); a barber login sees only his own bookings. Manual bookings go through
 * admin_create_appointment (owner: any barber; barber: only himself) — status "confirmed",
 * source "admin"; the database refuses overlaps (SLOT_TAKEN).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { appointmentsKey } from '@/features/appointments/api'
import { supabase } from '@/lib/supabase'

export type HoursRow = { staffId: string; weekday: number; start: number; end: number } // minutes
export type OffRow = {
  staffId: string | null
  startsAt: string
  endsAt: string
  reason: string | null
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

export function useSalonHours(businessId: string) {
  return useQuery({
    queryKey: ['salon-hours', businessId],
    queryFn: async (): Promise<HoursRow[]> => {
      const { data, error } = await supabase
        .from('working_hours')
        .select('staff_id, weekday, start_time, end_time')
        .eq('business_id', businessId)
      if (error) throw error
      return data.map((r) => ({
        staffId: r.staff_id,
        weekday: r.weekday,
        start: toMin(r.start_time),
        end: toMin(r.end_time),
      }))
    },
  })
}

export function useSalonTimeOff(businessId: string) {
  return useQuery({
    queryKey: ['salon-time-off', businessId],
    queryFn: async (): Promise<OffRow[]> => {
      const { data, error } = await supabase
        .from('time_off')
        .select('staff_id, starts_at, ends_at, reason')
        .eq('business_id', businessId)
        .gt('ends_at', new Date(Date.now() - 31 * 864e5).toISOString())
      if (error) throw error
      return data.map((r) => ({
        staffId: r.staff_id,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        reason: r.reason,
      }))
    },
  })
}

export function useCreateAppointment(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      serviceId: string
      staffId: string
      startsAt: string
      name: string
      phone: string
      note: string
    }) => {
      const { error } = await supabase.rpc('admin_create_appointment', {
        p_service_id: v.serviceId,
        p_staff_id: v.staffId,
        p_starts_at: v.startsAt,
        p_customer_name: v.name.trim().replace(/\s+/g, ' '),
        p_customer_phone: v.phone,
        p_customer_note: v.note.trim() || undefined,
      })
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: appointmentsKey(businessId) })
      void qc.invalidateQueries({ queryKey: ['slots'] })
    },
  })
}
