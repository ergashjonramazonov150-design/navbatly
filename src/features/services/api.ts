import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { ServiceFormValues } from './schemas'

/*
 * Services data access. Every query is limited by RLS (owner of an ACTIVE salon can write;
 * migration 4 + 7). We only send the columns the owner is allowed to update (column grants).
 */

export type ServiceItem = {
  id: string
  name: string
  description: string | null
  /** stored `lg` path of the optional service photo */
  photoPath: string | null
  durationMinutes: number
  priceUzs: number
  isActive: boolean
  sortOrder: number
  staffCount: number
}

export const servicesKey = (businessId: string) => ['services', businessId] as const

export function useServices(businessId: string) {
  return useQuery({
    queryKey: servicesKey(businessId),
    queryFn: async (): Promise<ServiceItem[]> => {
      const { data, error } = await supabase
        .from('services')
        .select(
          'id, name, description, photo_path, duration_minutes, price_uzs, is_active, sort_order, staff_services(count)',
        )
        .eq('business_id', businessId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return data.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        photoPath: s.photo_path,
        durationMinutes: s.duration_minutes,
        priceUzs: s.price_uzs,
        isActive: s.is_active,
        sortOrder: s.sort_order,
        staffCount: s.staff_services[0]?.count ?? 0,
      }))
    },
  })
}

const toRow = (v: ServiceFormValues) => ({
  name: v.name,
  description: v.description || null,
  duration_minutes: v.duration,
  price_uzs: v.price,
  is_active: v.isActive,
})

export function useSaveService(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      values: ServiceFormValues
      nextSortOrder: number
    }) => {
      if (input.id) {
        const { data, error } = await supabase
          .from('services')
          .update(toRow(input.values))
          .eq('id', input.id)
          .select('id')
          .single() // 0 rows (e.g. RLS) → PGRST116 → "not found / no permission"
        if (error) throw error
        return data
      }
      const { data, error } = await supabase
        .from('services')
        .insert({
          ...toRow(input.values),
          business_id: businessId,
          sort_order: input.nextSortOrder,
        })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSettled: () => qc.invalidateQueries({ queryKey: servicesKey(businessId) }),
  })
}

export function useSetServiceActive(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('services')
        .update({ is_active: isActive })
        .eq('id', id)
        .select('id')
        .single()
      if (error) throw error
    },
    // optimistic: flip the switch immediately, roll back on error
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: servicesKey(businessId) })
      const previous = qc.getQueryData<ServiceItem[]>(servicesKey(businessId))
      qc.setQueryData<ServiceItem[]>(servicesKey(businessId), (list) =>
        list?.map((s) => (s.id === id ? { ...s, isActive } : s)),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(servicesKey(businessId), ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: servicesKey(businessId) }),
  })
}

/** Future pending/confirmed bookings for a service — shown before deactivating it. */
export async function countFutureBookingsForService(serviceId: string): Promise<number> {
  const { count, error } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('service_id', serviceId)
    .in('status', ['pending', 'confirmed'])
    .gte('starts_at', new Date().toISOString())
  if (error) throw error
  return count ?? 0
}
