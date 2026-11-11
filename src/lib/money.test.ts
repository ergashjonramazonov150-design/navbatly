import { describe, expect, it } from 'vitest'

import { formatNumber, formatUzs, priceDigits } from './money'

const NBSP = ' '

describe('money', () => {
  it('groups thousands with a NON-BREAKING space', () => {
    expect(formatNumber(80000)).toBe(`80${NBSP}000`)
    expect(formatNumber(1250000)).toBe(`1${NBSP}250${NBSP}000`)
    expect(formatNumber(500)).toBe('500')
    expect(formatNumber(0)).toBe('0')
  })

  it("formats so'm with no line-break point", () => {
    expect(formatUzs(80000)).toBe(`80${NBSP}000${NBSP}so'm`)
    expect(formatUzs(120000)).not.toMatch(/ /) // no normal spaces at all
  })

  it('cleans typed/pasted prices to digits', () => {
    expect(priceDigits("80 000 so'm")).toBe('80000')
    expect(priceDigits('80.000')).toBe('80000')
    expect(priceDigits('  120000 ')).toBe('120000')
    expect(priceDigits('00500')).toBe('500')
    expect(priceDigits('0')).toBe('0')
    expect(priceDigits('')).toBe('')
    expect(priceDigits('1234567890123')).toBe('123456789') // max 9 digits
  })
})
