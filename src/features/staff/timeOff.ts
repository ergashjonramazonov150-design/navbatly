/** Pure rules for days-off ranges (no React), used by TimeOffPanel. */

export const MAX_TIME_OFF_DAYS = 366

/** Inclusive number of calendar days between two date keys ("2026-11-13"). */
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1

export type TimeOffError = 'fromRequired' | 'past' | 'toBeforeFrom' | 'tooLong' | null

/** Validates a whole-day range entered in the salon's local dates. */
export function validateRange(from: string, to: string, today: string): TimeOffError {
  if (!from) return 'fromRequired'
  if (from < today) return 'past'
  if (to < from) return 'toBeforeFrom'
  if (daysBetween(from, to) > MAX_TIME_OFF_DAYS) return 'tooLong'
  return null
}
