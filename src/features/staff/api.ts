import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { isoWeekday } from '@/lib/datetime'
import { supabase } from '@/lib/supabase'
import { weekFromRows, weekToPayload, type Interval, type Week, type Weekday } from './hours'

/*
 * Barbers (staff), their services, working hours and days off.
 * All writes are limited by RLS to the owner of an ACTIVE salon (migrations 4 + 7);
 * working hours are saved all-or-nothing by replace_working_hours (migration 8).
 */

export type StaffItem = {
  id: string
  fullName: string
  bio: string | null
  /** stored `lg` path of the barber photo (null = initials) */
  photoPath: string | null
  isActive: boolean
  sortOrder: number
  serviceIds: string[]
  hasLogin: boolean
  todayHours: Interval[]
}

export const staffListKey = (businessId: string) => ['staff', businessId] as const
export const hoursKey = (staffId: string) => ['working-hours', staffId] as const
export const timeOffKey = (staffId: string | null, businessId: string) =>
  ['time-off', businessId, staffId] as const

export function useStaffList(businessId: string, timezone: string) {
  return useQuery({
    queryKey: staffListKey(businessId),
    queryFn: async (): Promise<StaffItem[]> => {
      const [staffRes, hoursRes, membersRes] = await Promise.all([
        supabase
          .from('staff')
          .select(
            'id, full_name, bio, photo_path, is_active, sort_order, staff_services(service_id)',
          )
          .eq('business_id', businessId)
          .order('sort_order', { ascending: true })
          .order('full_name', { ascending: true }),
        supabase
          .from('working_hours')
          .select('staff_id, weekday, start_time, end_time')
          .eq('business_id', businessId),
        supabase
          .from('business_members')
          .select('staff_id')
          .eq('business_id', businessId)
          .not('staff_id', 'is', null),
      ])
      if (staffRes.error) throw staffRes.error
      if (hoursRes.error) throw hoursRes.error
      if (membersRes.error) throw membersRes.error

      const today = isoWeekday(Date.now(), timezone) as Weekday
      const withLogin = new Set(membersRes.data.map((m) => m.staff_id))
      return staffRes.data.map((s) => ({
        id: s.id,
        fullName: s.full_name,
        bio: s.bio,
        photoPath: s.photo_path,
        isActive: s.is_active,
        sortOrder: s.sort_order,
        serviceIds: s.staff_services.map((x) => x.service_id),
        hasLogin: withLogin.has(s.id),
        todayHours: weekFromRows(hoursRes.data.filter((h) => h.staff_id === s.id))[today],
      }))
    },
  })
}

export function useSaveStaff(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      fullName: string
      bio: string
      nextSortOrder?: number
    }) => {
      const row = { full_name: input.fullName, bio: input.bio || null }
      const query = input.id
        ? supabase.from('staff').update(row).eq('id', input.id)
        : supabase
            .from('staff')
            .insert({ ...row, business_id: businessId, sort_order: input.nextSortOrder ?? 0 })
      const { data, error } = await query.select('id').single()
      if (error) throw error
      return data
    },
    onSettled: () => qc.invalidateQueries({ queryKey: staffListKey(businessId) }),
  })
}

export function useSetStaffActive(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('staff')
        .update({ is_active: isActive })
        .eq('id', id)
        .select('id')
        .single()
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: staffListKey(businessId) }),
  })
}

// ---------------------------------------------------------------- booking-impact counts
const ACTIVE_STATUSES = ['pending', 'confirmed'] as const

/** Future pending/confirmed bookings of a barber (warning before deactivating). */
export async function countFutureBookingsForStaff(staffId: string): Promise<number> {
  const { count, error } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('staff_id', staffId)
    .in('status', ACTIVE_STATUSES)
    .gte('starts_at', new Date().toISOString())
  if (error) throw error
  return count ?? 0
}

/**
 * Future pending/confirmed bookings overlapping [fromIso, toIso) — warning before adding a
 * day off. staffId = null → the whole salon (salon-wide closed day, delivery 3c).
 */
export async function countBookingsInRange(args: {
  businessId: string
  staffId: string | null
  fromIso: string
  toIso: string
}): Promise<number> {
  let q = supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', args.businessId)
    .in('status', ACTIVE_STATUSES)
    .lt('starts_at', args.toIso)
    .gt('ends_at', args.fromIso)
    .gte('starts_at', new Date().toISOString())
  if (args.staffId) q = q.eq('staff_id', args.staffId)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

// ---------------------------------------------------------------- working hours
export function useWorkingHours(staffId: string) {
  return useQuery({
    queryKey: hoursKey(staffId),
    queryFn: async (): Promise<Week> => {
      const { data, error } = await supabase
        .from('working_hours')
        .select('weekday, start_time, end_time')
        .eq('staff_id', staffId)
      if (error) throw error
      return weekFromRows(data)
    },
  })
}

/** How many future bookings fit the CURRENT hours but not the NEW week (migration 8). */
export async function countBookingsOutsideNewHours(staffId: string, week: Week): Promise<number> {
  const { data, error } = await supabase.rpc('count_bookings_outside_new_hours', {
    p_staff_id: staffId,
    p_week: weekToPayload(week),
  })
  if (error) throw error
  return data ?? 0
}

export function useReplaceWorkingHours(staffId: string, businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (week: Week) => {
      const { error } = await supabase.rpc('replace_working_hours', {
        p_staff_id: staffId,
        p_week: weekToPayload(week),
      })
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: hoursKey(staffId) })
      void qc.invalidateQueries({ queryKey: staffListKey(businessId) })
    },
  })
}

// ---------------------------------------------------------------- services of a barber
export function useToggleStaffService(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { staffId: string; serviceId: string; enabled: boolean }) => {
      const { error } = args.enabled
        ? await supabase
            .from('staff_services')
            .insert({ business_id: businessId, staff_id: args.staffId, service_id: args.serviceId })
        : await supabase
            .from('staff_services')
            .delete()
            .eq('staff_id', args.staffId)
            .eq('service_id', args.serviceId)
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: staffListKey(businessId) })
      void qc.invalidateQueries({ queryKey: ['services', businessId] }) // barber counts
    },
  })
}

// ---------------------------------------------------------------- days off
export type TimeOffItem = { id: string; startsAt: string; endsAt: string; reason: string | null }

/** Current and future days off of a barber (or salon-wide when staffId = null). */
export function useTimeOff(businessId: string, staffId: string | null) {
  return useQuery({
    queryKey: timeOffKey(staffId, businessId),
    queryFn: async (): Promise<TimeOffItem[]> => {
      let q = supabase
        .from('time_off')
        .select('id, starts_at, ends_at, reason')
        .eq('business_id', businessId)
        .gt('ends_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
      q = staffId ? q.eq('staff_id', staffId) : q.is('staff_id', null)
      const { data, error } = await q
      if (error) throw error
      return data.map((r) => ({
        id: r.id,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        reason: r.reason,
      }))
    },
  })
}

export function useAddTimeOff(businessId: string, staffId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { fromIso: string; toIso: string; reason: string }) => {
      const { error } = await supabase.from('time_off').insert({
        business_id: businessId,
        staff_id: staffId,
        starts_at: args.fromIso,
        ends_at: args.toIso,
        reason: args.reason || null,
      })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: timeOffKey(staffId, businessId) }),
  })
}

export function useDeleteTimeOff(businessId: string, staffId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_off').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: timeOffKey(staffId, businessId) }),
  })
}
