import { describe, expect, it } from 'vitest'

import { dbErrorKey } from './dbErrors'

describe('dbErrorKey', () => {
  it.each([
    ['23514', 'db.invalidValue'],
    ['23P01', 'db.overlap'],
    ['23505', 'db.duplicate'],
    ['42501', 'db.forbidden'],
    ['PGRST116', 'db.notFound'],
  ])('code %s → %s', (code, key) => {
    expect(dbErrorKey({ code, message: 'raw sql text' })).toBe(key)
  })

  it('network failures', () => {
    expect(dbErrorKey(new TypeError('Failed to fetch'))).toBe('db.network')
    expect(dbErrorKey({ message: 'TypeError: NetworkError when attempting to fetch' })).toBe(
      'db.network',
    )
  })

  it('unknown / odd input never throws', () => {
    expect(dbErrorKey({ code: 'XX000' })).toBe('db.unknown')
    expect(dbErrorKey(undefined)).toBe('db.unknown')
  })
})
