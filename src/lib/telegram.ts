/**
 * Telegram bot links (the bot is shared by all salons).
 *   t.me/<bot>?start=<slug>        → customers: the bot replies with that salon's "Yozilish" Mini App
 *   t.me/<bot>?start=link_<code>   → owner linking ("Botni ulash"), one-time code (10 min)
 * Slugs never contain "_", so the two can't be confused.
 */
export const BOT_USERNAME = 'navbatly_uz_bot'

export const salonBotLink = (slug: string) => `https://t.me/${BOT_USERNAME}?start=${slug}`
export const ownerLinkUrl = (code: string) => `https://t.me/${BOT_USERNAME}?start=link_${code}`

/** 43-char random code (32 bytes, base64url) — works on plain http too (getRandomValues). */
export function randomLinkCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
