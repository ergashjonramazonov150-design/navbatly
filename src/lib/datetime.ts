/**
 * ALL date/time helpers live here.
 *
 * Rule: components never call `date.getHours()` or format dates themselves.
 * Times are stored in the database as UTC (`timestamptz`) and are always
 * SHOWN in the business's timezone — never the visitor's browser timezone.
 * See docs/ARCHITECTURE.md §2.5.
 */
import { TZDate } from '@date-fns/tz'
import { format, type Locale } from 'date-fns'
import { ru, uz } from 'date-fns/locale'

export const DEFAULT_TIMEZONE = 'Asia/Tashkent'

export type AppLanguage = 'uz' | 'ru'

const DATE_FNS_LOCALES: Record<AppLanguage, Locale> = { uz, ru }

type DateInput = Date | string | number

/** The same moment in time, but "seen" from the business's timezone. */
export function toBusinessTime(date: DateInput, timeZone = DEFAULT_TIMEZONE): TZDate {
  return new TZDate(new Date(date).getTime(), timeZone)
}

/** Current moment in the business's timezone. */
export function businessNow(timeZone = DEFAULT_TIMEZONE): TZDate {
  return TZDate.tz(timeZone)
}

/** Generic formatter. `pattern` uses date-fns tokens, e.g. 'HH:mm', 'd MMMM'. */
export function formatInBusinessTz(
  date: DateInput,
  pattern: string,
  { timeZone = DEFAULT_TIMEZONE, lang = 'uz' }: { timeZone?: string; lang?: AppLanguage } = {},
): string {
  return format(toBusinessTime(date, timeZone), pattern, { locale: DATE_FNS_LOCALES[lang] })
}

/** "15:30" */
export function formatTime(date: DateInput, timeZone = DEFAULT_TIMEZONE): string {
  return formatInBusinessTz(date, 'HH:mm', { timeZone })
}

/** "2026-11-12" — the calendar day in the business timezone (used as a key / RPC param). */
export function toDateKey(date: DateInput, timeZone = DEFAULT_TIMEZONE): string {
  return formatInBusinessTz(date, 'yyyy-MM-dd', { timeZone })
}

/** Today's date key in the salon's timezone (not the browser's). */
export function todayKey(timeZone = DEFAULT_TIMEZONE): string {
  return toDateKey(Date.now(), timeZone)
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a moment, in the salon's timezone. */
export function isoWeekday(date: DateInput, timeZone = DEFAULT_TIMEZONE): number {
  return Number(formatInBusinessTz(date, 'i', { timeZone }))
}

/** "2026-11-17" + n days → date key (pure calendar arithmetic, no timezone involved). */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

/**
 * Start of a LOCAL calendar day as an exact UTC moment (ISO string).
 * "2026-11-17" in Tashkent (UTC+5) → "2026-11-16T19:00:00.000Z".
 */
export function localDayStartUtc(key: string, timeZone = DEFAULT_TIMEZONE): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, timeZone).getTime()).toISOString()
}

const MONTHS_UZ = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
]

/** "2026-11-17" → "17-noyabr" (Uzbek date style). */
export function formatDayMonthUz(key: string): string {
  const [, m, d] = key.split('-').map(Number)
  return `${d}-${MONTHS_UZ[m - 1]}`
}
