import { describe, expect, it } from 'vitest'

import { cleanLocalDigits, formatLocal, toE164, toLocalDigits } from './phone'

describe('phone', () => {
  it('keeps only up to 9 digits', () => {
    expect(cleanLocalDigits('90 123-45-67')).toBe('901234567')
    expect(cleanLocalDigits('9012345678999')).toBe('901234567')
  })

  it('converts between stored and typed forms', () => {
    expect(toLocalDigits('+998901234567')).toBe('901234567')
    expect(toLocalDigits(null)).toBe('')
    expect(toLocalDigits('+7901234567')).toBe('')
    expect(toE164('901234567')).toBe('+998901234567')
  })

  it('formats full and partial numbers', () => {
    expect(formatLocal('901234567')).toBe('90 123 45 67')
    expect(formatLocal('9012')).toBe('90 12')
    expect(formatLocal('')).toBe('')
  })
})
