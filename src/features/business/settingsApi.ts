import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

/*
 * Salon settings (Sozlamalar). The owner may update only the columns granted in
 * migration 4 — name, phone, address and the booking rules. Slug, timezone and
 * is_active are platform-admin only (the database refuses them).
 */

export type BusinessSettings = {
  name: string
  phone: string | null
  address: string | null
  slug: string
  timezone: string
  slotStep: number
  horizonDays: number
  noticeMinutes: number
  maxPerPhone: number
  autoConfirm: boolean
}

export type BusinessSettingsUpdate = Omit<BusinessSettings, 'slug' | 'timezone'>

export const settingsKey = (businessId: string) => ['business-settings', businessId] as const

export function useBusinessSettings(businessId: string) {
  return useQuery({
    queryKey: settingsKey(businessId),
    queryFn: async (): Promise<BusinessSettings> => {
      const { data, error } = await supabase
        .from('businesses')
        .select(
          'name, phone, address, slug, timezone, slot_step_minutes, booking_horizon_days, min_notice_minutes, max_active_bookings_per_phone, auto_confirm',
        )
        .eq('id', businessId)
        .single()
      if (error) throw error
      return {
        name: data.name,
        phone: data.phone,
        address: data.address,
        slug: data.slug,
        timezone: data.timezone,
        slotStep: data.slot_step_minutes,
        horizonDays: data.booking_horizon_days,
        noticeMinutes: data.min_notice_minutes,
        maxPerPhone: data.max_active_bookings_per_phone,
        autoConfirm: data.auto_confirm,
      }
    },
  })
}

export function useSaveBusinessSettings(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: BusinessSettingsUpdate) => {
      // .select().single() → if RLS silently matched 0 rows we get PGRST116, not a fake success
      const { error } = await supabase
        .from('businesses')
        .update({
          name: s.name,
          phone: s.phone,
          address: s.address,
          slot_step_minutes: s.slotStep,
          booking_horizon_days: s.horizonDays,
          min_notice_minutes: s.noticeMinutes,
          max_active_bookings_per_phone: s.maxPerPhone,
          auto_confirm: s.autoConfirm,
        })
        .eq('id', businessId)
        .select('id')
        .single()
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: settingsKey(businessId) })
      // the salon name is shown in the menu / header
      void qc.invalidateQueries({ queryKey: ['business-context'] })
    },
  })
}
