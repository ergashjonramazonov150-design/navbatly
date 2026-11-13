/** "Jasur" → "J", "Ali Valiyev" → "AV". Used by the fallback avatar until photos arrive (M3.5). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0]?.[0] ?? '?')).toUpperCase()
}
