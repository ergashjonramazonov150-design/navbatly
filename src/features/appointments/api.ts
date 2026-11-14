/**
 * Admin bookings list (M5, simplified). RLS decides what each login sees:
 * owner → the whole salon, barber → only his own bookings (migration 4/7).
 * Status changes only through set_appointment_status (permission + allowed transitions
 * are checked in the database; who/when is recorded).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { addDaysToKey, localDayStartUtc, todayKey } from '@/lib/datetime'
import { supabase } from '@/lib/supabase'

export type ApptStatus = 'pending' | 'confirmed' | 'cancelled'
export type Appointment = {
  id: string
  startsAt: string
  endsAt: string
  status: ApptStatus
  source: 'online' | 'admin'
  customerName: string
  customerPhone: string
  customerNote: string | null
  priceUzs: number
  cancelReason: string | null
  staffId: string
  staffName: string
  serviceName: string
}

const PAST_DAYS = 30
const FUTURE_DAYS = 60

export const appointmentsKey = (businessId: string) => ['appointments', businessId] as const

export function useAppointments(businessId: string, timezone: string) {
  return useQuery({
    queryKey: appointmentsKey(businessId),
    refetchInterval: 60_000, // new online bookings appear within a minute
    queryFn: async (): Promise<Appointment[]> => {
      const today = todayKey(timezone)
      const { data, error } = await supabase
        .from('appointments')
        .select(
          'id, starts_at, ends_at, status, source, customer_name, customer_phone, customer_note, price_uzs, cancel_reason, staff_id, services(name), staff(full_name)',
        )
        .eq('business_id', businessId)
        .gte('starts_at', localDayStartUtc(addDaysToKey(today, -PAST_DAYS), timezone))
        .lt('starts_at', localDayStartUtc(addDaysToKey(today, FUTURE_DAYS), timezone))
        .order('starts_at', { ascending: true })
        .limit(1000)
      if (error) throw error
      return data.map((a) => ({
        id: a.id,
        startsAt: a.starts_at,
        endsAt: a.ends_at,
        status: a.status,
        source: a.source,
        customerName: a.customer_name,
        customerPhone: a.customer_phone,
        customerNote: a.customer_note,
        priceUzs: a.price_uzs,
        cancelReason: a.cancel_reason,
        staffId: a.staff_id,
        staffName: a.staff?.full_name ?? '',
        serviceName: a.services?.name ?? '',
      }))
    },
  })
}

export function useSetAppointmentStatus(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; status: 'confirmed' | 'cancelled'; reason?: string }) => {
      const { error } = await supabase.rpc('set_appointment_status', {
        p_appointment_id: v.id,
        p_status: v.status,
        p_cancel_reason: v.reason?.trim() || undefined,
      })
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: appointmentsKey(businessId) })
      void qc.invalidateQueries({ queryKey: ['slots'] }) // a cancelled time is free again
    },
  })
}
