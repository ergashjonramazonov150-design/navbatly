/**
 * Uzbek phone numbers. Stored as "+998XXXXXXXXX" (database CHECK), typed as the
 * 9 digits after +998, shown as "90 123 45 67".
 */
export const UZ_PREFIX = '+998'

/** Keeps only digits, max 9 — what the user may type after the fixed "+998". */
export const cleanLocalDigits = (input: string) => input.replace(/\D/g, '').slice(0, 9)

/** "+998901234567" → "901234567"; null/other → "". */
export const toLocalDigits = (e164: string | null | undefined) =>
  e164 && /^\+998\d{9}$/.test(e164) ? e164.slice(4) : ''

/** "901234567" → "+998901234567". */
export const toE164 = (digits: string) => `${UZ_PREFIX}${digits}`

/** "901234567" → "90 123 45 67" (also formats partial input while typing). */
export function formatLocal(digits: string): string {
  const d = cleanLocalDigits(digits)
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ')
}
