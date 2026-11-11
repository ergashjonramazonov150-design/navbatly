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
