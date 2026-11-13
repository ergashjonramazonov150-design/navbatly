/**
 * Working-hours logic for the "Ish vaqti" editor (pure functions — easy to test).
 * Times are minutes from midnight in the SALON's local time. Weekday: 1 = Monday … 7 = Sunday.
 * The database enforces the same rules (CHECK end > start, EXCLUDE no overlap; migration 8
 * saves the whole week all-or-nothing).
 */

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type Interval = { start: number; end: number }
export type Week = Record<Weekday, Interval[]>

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7]

/** Default when a day is switched on (seed schedule: 09–13 and 14–20). */
export const DEFAULT_DAY: Interval[] = [
  { start: 9 * 60, end: 13 * 60 },
  { start: 14 * 60, end: 20 * 60 },
]

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export const toHHMM = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export const emptyWeek = (): Week => ({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] })

const sortDay = (day: Interval[]) => [...day].sort((a, b) => a.start - b.start)

/** Database rows ("09:00:00") → editor week. */
export function weekFromRows(
  rows: { weekday: number; start_time: string; end_time: string }[],
): Week {
  const week = emptyWeek()
  for (const r of rows) {
    if (r.weekday < 1 || r.weekday > 7) continue
    week[r.weekday as Weekday].push({
      start: toMinutes(r.start_time.slice(0, 5)),
      end: toMinutes(r.end_time.slice(0, 5)),
    })
  }
  for (const d of WEEKDAYS) week[d] = sortDay(week[d])
  return week
}

/** Editor week → JSON for replace_working_hours / count_bookings_outside_new_hours. */
export function weekToPayload(week: Week) {
  return WEEKDAYS.flatMap((weekday) =>
    sortDay(week[weekday]).map((i) => ({ weekday, start: toHHMM(i.start), end: toHHMM(i.end) })),
  )
}

export type DayError = 'endBeforeStart' | 'overlap' | null

/** Same rules as the database: end after start; no overlapping intervals on one day. */
export function dayError(day: Interval[]): DayError {
  if (day.some((i) => i.end <= i.start)) return 'endBeforeStart'
  const sorted = sortDay(day)
  for (let k = 1; k < sorted.length; k++) {
    if (sorted[k].start < sorted[k - 1].end) return 'overlap'
  }
  return null
}

export const weekHasErrors = (week: Week) => WEEKDAYS.some((d) => dayError(week[d]) !== null)

/** "Dushanbani barcha ish kunlariga nusxalash": Monday → Tuesday…Saturday (Sunday untouched). */
export function copyMondayToWorkdays(week: Week): Week {
  const next = { ...week }
  for (const d of [2, 3, 4, 5, 6] as Weekday[]) next[d] = week[1].map((i) => ({ ...i }))
  return next
}

/** A sensible new interval after the last one of the day (or the default day start). */
export function nextInterval(day: Interval[]): Interval {
  const last = sortDay(day).at(-1)
  if (!last) return { start: 9 * 60, end: 18 * 60 }
  const start = Math.min(last.end + 60, 23 * 60)
  return { start, end: Math.min(start + 120, 23 * 60 + 45) }
}

export function weeksEqual(a: Week, b: Week): boolean {
  return JSON.stringify(weekToPayload(a)) === JSON.stringify(weekToPayload(b))
}

/** "09:00–13:00, 14:00–20:00" (en dash, used in lists). */
export const formatDay = (day: Interval[]) =>
  sortDay(day)
    .map((i) => `${toHHMM(i.start)}–${toHHMM(i.end)}`)
    .join(', ')
