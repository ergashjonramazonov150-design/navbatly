import { describe, expect, it } from 'vitest'

import { daysBetween, validateRange } from './timeOff'

describe('daysBetween', () => {
  it('counts both ends', () => {
    expect(daysBetween('2026-11-13', '2026-11-13')).toBe(1)
    expect(daysBetween('2026-11-13', '2026-11-15')).toBe(3)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(2)
  })
})

describe('validateRange', () => {
  const today = '2026-11-13'

  it('accepts today and future ranges', () => {
    expect(validateRange('2026-11-13', '2026-11-13', today)).toBeNull()
    expect(validateRange('2026-11-20', '2026-11-25', today)).toBeNull()
  })

  it('rejects empty, past, reversed and too-long ranges', () => {
    expect(validateRange('', '', today)).toBe('fromRequired')
    expect(validateRange('2026-11-12', '2026-11-14', today)).toBe('past')
    expect(validateRange('2026-11-20', '2026-11-19', today)).toBe('toBeforeFrom')
    expect(validateRange('2026-11-13', '2027-11-14', today)).toBe('tooLong')
  })
})
