import { describe, expect, it } from 'vitest'

import { HORIZON_OPTIONS, settingsSchema, withCurrent } from './settings'

const valid = {
  name: 'Navbatly Demo',
  phone: '901234567',
  address: 'Toshkent',
  slotStep: '15',
  horizonDays: '30',
  noticeMinutes: '60',
  maxPerPhone: '3',
  autoConfirm: false,
}

const firstError = (input: object) => {
  const r = settingsSchema.safeParse(input)
  return r.success ? null : r.error.issues[0].message
}

describe('settingsSchema', () => {
  it('accepts a valid form and turns choices into numbers', () => {
    const r = settingsSchema.parse({ ...valid, name: '  Navbatly Demo  ' })
    expect(r).toMatchObject({ name: 'Navbatly Demo', slotStep: 15, horizonDays: 30 })
  })

  it('allows an empty phone (no public number)', () => {
    expect(firstError({ ...valid, phone: '' })).toBeNull()
  })

  it('rejects short names, partial phones and long addresses', () => {
    expect(firstError({ ...valid, name: 'A' })).toBe('validation.salonNameMin')
    expect(firstError({ ...valid, name: 'x'.repeat(101) })).toBe('validation.salonNameMax')
    expect(firstError({ ...valid, phone: '90123' })).toBe('validation.phoneInvalid')
    expect(firstError({ ...valid, address: 'x'.repeat(201) })).toBe('validation.addressMax')
  })
})

describe('withCurrent', () => {
  it('adds an unusual current value in order, keeps the list otherwise', () => {
    expect(withCurrent(HORIZON_OPTIONS, 30)).toEqual([7, 14, 30, 60, 90])
    expect(withCurrent(HORIZON_OPTIONS, 45)).toEqual([7, 14, 30, 45, 60, 90])
  })
})
