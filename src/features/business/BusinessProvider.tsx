import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { supabase } from '@/lib/supabase'
import {
  BusinessContext,
  resolveBusinessState,
  type BusinessContextValue,
  type BusinessRows,
} from './business-context'

/**
 * Loads "who am I in which salon" for the logged-in user.
 * RLS guarantees these queries only ever return the user's own rows.
 * MVP: a login belongs to one salon; if there were several, the oldest membership wins.
 */
async function fetchBusinessRows(userId: string): Promise<BusinessRows> {
  const { data: members, error } = await supabase
    .from('business_members')
    .select('role, business_id, staff_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error

  const membership = members[0] ?? null
  if (!membership) return { membership: null, business: null, staff: null }

  const [businessRes, staffRes] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, name, slug, is_active')
      .eq('id', membership.business_id)
      .maybeSingle(),
    membership.staff_id
      ? supabase
          .from('staff')
          .select('id, full_name, is_active')
          .eq('id', membership.staff_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (businessRes.error) throw businessRes.error
  if (staffRes.error) throw staffRes.error

  return { membership, business: businessRes.data, staff: staffRes.data }
}

export function BusinessProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const query = useQuery({
    queryKey: ['business-context', userId],
    queryFn: () => fetchBusinessRows(userId),
    staleTime: 5 * 60_000,
  })

  let value: BusinessContextValue
  if (query.isPending) value = { status: 'loading' }
  else if (query.isError) value = { status: 'error', retry: () => void query.refetch() }
  else value = resolveBusinessState(query.data)

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}
