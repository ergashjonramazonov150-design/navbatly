import { createContext } from 'react'

import type { Database } from '@/types/database.types'

export type MemberRole = Database['public']['Enums']['member_role']

export type BusinessContextValue =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'no-business' }
  | { status: 'inactive' }
  | {
      status: 'ready'
      role: MemberRole
      businessId: string
      businessName: string
      businessSlug: string
      /** IANA timezone of the salon, e.g. 'Asia/Tashkent' — all times are shown in it */
      timezone: string
      /** the bookable staff profile linked to this login (null for an owner who doesn't cut hair) */
      staffId: string | null
      staffName: string | null
    }

export const BusinessContext = createContext<BusinessContextValue | null>(null)

/** What we load from the database for the logged-in user (all rows already limited by RLS). */
export type BusinessRows = {
  membership: { role: MemberRole; business_id: string; staff_id: string | null } | null
  business: { id: string; name: string; slug: string; is_active: boolean; timezone: string } | null
  staff: { id: string; full_name: string; is_active: boolean } | null
}

/**
 * The single place that decides what a logged-in user may enter.
 *   - no membership / salon not visible  → 'no-business'
 *   - salon switched off                  → 'inactive'
 *   - STAFF whose staff profile is off     → 'inactive' ("Hisobingiz vaqtincha faolsizlantirilgan")
 *   - otherwise                            → 'ready'
 * Owners are never blocked by their own (optional) staff profile being inactive.
 */
export function resolveBusinessState(
  rows: BusinessRows,
): Exclude<BusinessContextValue, { status: 'loading' } | { status: 'error' }> {
  const { membership, business, staff } = rows
  if (!membership || !business) return { status: 'no-business' }
  if (!business.is_active) return { status: 'inactive' }
  if (membership.role === 'staff' && staff && !staff.is_active) return { status: 'inactive' }

  return {
    status: 'ready',
    role: membership.role,
    businessId: business.id,
    businessName: business.name,
    businessSlug: business.slug,
    timezone: business.timezone,
    staffId: staff?.id ?? null,
    staffName: staff?.full_name ?? null,
  }
}
