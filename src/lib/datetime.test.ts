import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  addDaysToKey,
  formatDayMonthUz,
  isoWeekday,
  localDayStartUtc,
  toDateKey,
  todayKey,
} from './datetime'

// Run these in a FAR-AWAY browser timezone: results must still be Tashkent-based.
beforeAll(() => {
  vi.stubEnv('TZ', 'America/Los_Angeles')
})
afterAll(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('datetime (salon timezone = Asia/Tashkent, UTC+5)', () => {
  it('start of a local day is 19:00 UTC the day before', () => {
    expect(localDayStartUtc('2026-11-17')).toBe('2026-11-16T19:00:00.000Z')
  })

  it('date key and weekday follow Tashkent, not the browser', () => {
    // 2026-11-16 20:30 UTC = 2026-11-17 01:30 in Tashkent (a Tuesday)
    const moment = '2026-11-16T20:30:00Z'
    expect(toDateKey(moment)).toBe('2026-11-17')
    expect(isoWeekday(moment)).toBe(2)
  })

  it('today is computed in Tashkent', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-16T20:30:00Z')) // still the 16th in Los Angeles
    expect(todayKey()).toBe('2026-11-17')
    vi.useRealTimers()
  })

  it('adds calendar days across month and year ends', () => {
    expect(addDaysToKey('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('formats Uzbek day-month', () => {
    expect(formatDayMonthUz('2026-11-17')).toBe('17-noyabr')
    expect(formatDayMonthUz('2027-01-01')).toBe('1-yanvar')
  })
})
