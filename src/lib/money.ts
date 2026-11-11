/**
 * Uzbek so'm formatting. Prices are whole so'm (no tiyin), stored as integers.
 * A non-breaking space (U+00A0) is used everywhere so "80 000 so'm" never breaks
 * across lines on a phone.
 */
const NBSP = ' '

/** 80000 → "80 000" */
export function formatNumber(value: number): string {
  const n = Math.round(Math.abs(value))
  const grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return value < 0 ? `-${grouped}` : grouped
}

/** 80000 → "80 000 so'm" */
export function formatUzs(value: number): string {
  return `${formatNumber(value)}${NBSP}so'm`
}

/** "80 000 so'm" / "80.000" / " 80000 " → "80000" (digits only, max 9 = < 1 billion) */
export function priceDigits(input: string): string {
  return input
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, 9)
}
