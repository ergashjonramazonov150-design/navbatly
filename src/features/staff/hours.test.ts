import { describe, expect, it } from 'vitest'

import {
  copyMondayToWorkdays,
  dayError,
  emptyWeek,
  formatDay,
  nextInterval,
  toHHMM,
  toMinutes,
  weekFromRows,
  weekHasErrors,
  weeksEqual,
  weekToPayload,
} from './hours'

const i = (a: string, b: string) => ({ start: toMinutes(a), end: toMinutes(b) })

describe('working hours logic', () => {
  it('converts times', () => {
    expect(toMinutes('09:30')).toBe(570)
    expect(toHHMM(570)).toBe('09:30')
    expect(toHHMM(0)).toBe('00:00')
  })

  it('reads database rows (with seconds) into a sorted week', () => {
    const week = weekFromRows([
      { weekday: 1, start_time: '14:00:00', end_time: '20:00:00' },
      { weekday: 1, start_time: '09:00:00', end_time: '13:00:00' },
      { weekday: 6, start_time: '10:00:00', end_time: '16:00:00' },
    ])
    expect(week[1]).toEqual([i('09:00', '13:00'), i('14:00', '20:00')])
    expect(week[6]).toEqual([i('10:00', '16:00')])
    expect(week[7]).toEqual([])
  })

  it('builds the JSON payload for the database function', () => {
    const week = emptyWeek()
    week[2] = [i('14:00', '19:00'), i('09:00', '13:00')]
    expect(weekToPayload(week)).toEqual([
      { weekday: 2, start: '09:00', end: '13:00' },
      { weekday: 2, start: '14:00', end: '19:00' },
    ])
  })

  it('validates a day exactly like the database', () => {
    expect(dayError([i('09:00', '13:00'), i('14:00', '20:00')])).toBeNull() // lunch break OK
    expect(dayError([i('09:00', '13:00'), i('13:00', '20:00')])).toBeNull() // back-to-back OK
    expect(dayError([i('09:00', '13:00'), i('12:00', '18:00')])).toBe('overlap')
    expect(dayError([i('18:00', '09:00')])).toBe('endBeforeStart')
    expect(dayError([i('10:00', '10:00')])).toBe('endBeforeStart')
    expect(dayError([])).toBeNull() // day off
  })

  it('flags a week with any bad day', () => {
    const week = emptyWeek()
    week[3] = [i('09:00', '13:00'), i('12:00', '18:00')]
    expect(weekHasErrors(week)).toBe(true)
    expect(weekHasErrors(emptyWeek())).toBe(false)
  })

  it('copies Monday to Tuesday–Saturday, leaves Sunday alone', () => {
    const week = emptyWeek()
    week[1] = [i('10:00', '14:00'), i('15:00', '19:00')]
    week[7] = [i('11:00', '15:00')]
    const copied = copyMondayToWorkdays(week)
    for (const d of [2, 3, 4, 5, 6] as const) expect(copied[d]).toEqual(week[1])
    expect(copied[7]).toEqual([i('11:00', '15:00')])
    copied[2][0].start = 0 // copies are independent
    expect(week[1][0].start).toBe(toMinutes('10:00'))
  })

  it('suggests a new interval after the last one', () => {
    expect(nextInterval([])).toEqual(i('09:00', '18:00'))
    expect(nextInterval([i('09:00', '13:00')])).toEqual(i('14:00', '16:00'))
    expect(nextInterval([i('09:00', '23:30')]).start).toBeLessThanOrEqual(23 * 60)
  })

  it('detects unsaved changes regardless of interval order', () => {
    const a = emptyWeek()
    a[1] = [i('09:00', '13:00'), i('14:00', '20:00')]
    const b = emptyWeek()
    b[1] = [i('14:00', '20:00'), i('09:00', '13:00')]
    expect(weeksEqual(a, b)).toBe(true)
    b[1] = [i('09:00', '12:00')]
    expect(weeksEqual(a, b)).toBe(false)
  })

  it('formats a day for lists', () => {
    expect(formatDay([i('14:00', '20:00'), i('09:00', '13:00')])).toBe('09:00–13:00, 14:00–20:00')
  })
})
