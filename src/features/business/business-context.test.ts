import { describe, expect, it } from 'vitest'

import { resolveBusinessState, type BusinessRows } from './business-context'

const business = { id: 'biz-1', name: 'Demo', slug: 'demo', is_active: true }
const jasur = { id: 'staff-1', full_name: 'Jasur', is_active: true }

const rows = (over: Partial<BusinessRows>): BusinessRows => ({
  membership: { role: 'staff', business_id: 'biz-1', staff_id: 'staff-1' },
  business,
  staff: jasur,
  ...over,
})

describe('resolveBusinessState', () => {
  it('no membership → no-business', () => {
    expect(resolveBusinessState(rows({ membership: null, business: null, staff: null }))).toEqual({
      status: 'no-business',
    })
  })

  it('salon not visible → no-business', () => {
    expect(resolveBusinessState(rows({ business: null })).status).toBe('no-business')
  })

  it('active staff → ready with their staff profile', () => {
    expect(resolveBusinessState(rows({}))).toEqual({
      status: 'ready',
      role: 'staff',
      businessId: 'biz-1',
      businessName: 'Demo',
      businessSlug: 'demo',
      staffId: 'staff-1',
      staffName: 'Jasur',
    })
  })

  it('INACTIVE staff profile → inactive ("Hisobingiz vaqtincha faolsizlantirilgan")', () => {
    expect(resolveBusinessState(rows({ staff: { ...jasur, is_active: false } })).status).toBe(
      'inactive',
    )
  })

  it('owner is NOT blocked by their own inactive staff profile', () => {
    const state = resolveBusinessState(
      rows({
        membership: { role: 'owner', business_id: 'biz-1', staff_id: 'staff-1' },
        staff: { ...jasur, is_active: false },
      }),
    )
    expect(state.status).toBe('ready')
  })

  it('owner without a staff profile → ready, staffId null', () => {
    const state = resolveBusinessState(
      rows({ membership: { role: 'owner', business_id: 'biz-1', staff_id: null }, staff: null }),
    )
    expect(state).toMatchObject({ status: 'ready', role: 'owner', staffId: null })
  })

  it('salon switched off → inactive for everyone', () => {
    const off = { ...business, is_active: false }
    expect(resolveBusinessState(rows({ business: off })).status).toBe('inactive')
    expect(
      resolveBusinessState(
        rows({
          business: off,
          membership: { role: 'owner', business_id: 'biz-1', staff_id: null },
          staff: null,
        }),
      ).status,
    ).toBe('inactive')
  })
})
