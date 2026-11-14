// Shared Telegram helpers for Edge Functions (Deno). The bot token lives ONLY in the
// TELEGRAM_BOT_TOKEN secret (Supabase → Edge Functions → Secrets).
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

export const BOT_USERNAME = 'navbatly_uz_bot'
export const APP_URL = 'https://navbatly.vercel.app'
/** Owner linking uses /start link_<code>; salon deep links use /start <slug> (slugs have no "_"). */
export const LINK_PREFIX = 'link_'

export function botToken(): string | null {
  const t = Deno.env.get('TELEGRAM_BOT_TOKEN')?.trim()
  return t && /^\d+:[A-Za-z0-9_-]{30,}$/.test(t) ? t : null
}

const enc = new TextEncoder()
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')

/**
 * Secret that Telegram sends back in X-Telegram-Bot-Api-Secret-Token on every webhook call.
 * Derived from the bot token, so no second secret is needed; nobody without the token can
 * compute it.
 */
export async function webhookSecret(token: string) {
  return hex(await hmac(enc.encode(token), 'navbatly-webhook-v1'))
}

/** Constant-time string comparison (no early exit). */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function tg(token: string, method: string, body: Record<string, unknown>) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      description?: string
      result?: unknown
    }
    return json.ok
      ? { ok: true as const, result: json.result }
      : { ok: false as const, error: json.description ?? `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'network error' }
  } finally {
    clearTimeout(timer)
  }
}

/** Customer text inside HTML messages must never become markup. */
export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function serverKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    return keys.default ?? Object.values(keys)[0]
  } catch {
    return undefined
  }
}

export const adminClient = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, serverKey()!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

/**
 * Mini App: checks Telegram's signed initData (Bot API "Validating data received via the
 * Mini App"): secret = HMAC_SHA256("WebAppData", bot_token); hash = HMAC_SHA256(secret,
 * data_check_string). Returns the Telegram user id, or null if invalid / older than maxAge.
 */
export async function verifyInitData(initData: string, token: string, maxAgeSec = 24 * 3600) {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secret = await hmac(enc.encode('WebAppData'), token)
  if (!safeEqual(hex(await hmac(secret, dataCheck)), hash)) return null
  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null
  try {
    const user = JSON.parse(params.get('user') ?? 'null') as { id?: number } | null
    return user?.id ? String(user.id) : null
  } catch {
    return null
  }
}
