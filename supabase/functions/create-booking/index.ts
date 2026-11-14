// create-booking — the ONLY way a customer (no login) can create a booking.
//
//   browser / Telegram Mini App → this function → public.create_booking() (server key)
//
// The database function re-checks everything (service/barber active, working hours,
// days off, notice + horizon, max active bookings per phone, per-IP rate limit) and the
// EXCLUDE constraint makes double booking impossible (SLOT_TAKEN).
// Anti-spam: honeypot + DB limits; Mini App bookings must carry Telegram-signed initData
// (verified here); web bookings need a Cloudflare Turnstile token once TURNSTILE_SECRET_KEY
// is set (M7).
// After a successful ONLINE booking the salon gets a Telegram message (M6), and a Mini App
// customer gets a short confirmation in their own chat — in the background; a Telegram
// problem never fails the booking (salon errors saved in last_error).
import { customerMessage, salonMessage, type BookingInfo } from '../_shared/bookingMessages.ts'
import {
  APP_URL,
  adminClient,
  botToken,
  serverKey,
  tg,
  verifyInitData,
} from '../_shared/telegram.ts'

const ALLOWED_ORIGINS = [
  /^https:\/\/navbatly\.vercel\.app$/,
  /^https:\/\/navbatly-[a-z0-9-]+\.vercel\.app$/, // Vercel preview deployments
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^http:\/\/(10|192\.168)\.[0-9.]+(:\d+)?$/, // dev server on home Wi-Fi (phone tests)
]

function cors(origin: string | null) {
  const ok = origin && ALLOWED_ORIGINS.some((re) => re.test(origin))
  return {
    'Access-Control-Allow-Origin': ok ? origin! : APP_URL,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    Vary: 'Origin',
  }
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HTTP_STATUS: Record<string, number> = {
  SLOT_TAKEN: 409,
  RATE_LIMITED: 429,
  TOO_MANY_BOOKINGS: 429,
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/* ------------------------------ Telegram messages ------------------------------ */
// salon chat (if linked + enabled) and, for Mini App bookings, the customer's own chat
async function notify(appointmentId: string, customerChatId: number | null) {
  const token = botToken()
  if (!token) return
  const db = adminClient()
  const { data: a } = await db
    .from('appointments')
    .select(
      'business_id, customer_name, customer_phone, customer_note, starts_at, status, price_uzs, services(name, duration_minutes), staff(full_name), businesses(name, timezone, phone, address)',
    )
    .eq('id', appointmentId)
    .single()
  if (!a) return

  // customer: ONLY the Telegram user whose signed initData made this booking. They opened
  // the Mini App from our bot, so the bot is allowed to write to them.
  const toCustomer = customerChatId
    ? tg(token, 'sendMessage', {
        chat_id: customerChatId,
        parse_mode: 'HTML',
        text: customerMessage(a as BookingInfo),
      }).then((r) => {
        if (!r.ok) console.error('customer message failed', r.error)
      })
    : Promise.resolve()

  const toSalon = (async () => {
    const { data: s } = await db
      .from('business_telegram_settings')
      .select('chat_id, is_enabled')
      .eq('business_id', a.business_id)
      .maybeSingle()
    if (!s?.chat_id || !s.is_enabled) return
    const r = await tg(token, 'sendMessage', {
      chat_id: s.chat_id,
      parse_mode: 'HTML',
      text: salonMessage(a as BookingInfo, customerChatId !== null),
      reply_markup: {
        inline_keyboard: [[{ text: 'Admin panelda ochish', url: `${APP_URL}/admin/appointments` }]],
      },
    })
    await db
      .from('business_telegram_settings')
      .update(
        r.ok
          ? { last_error: null, last_error_at: null }
          : { last_error: r.error.slice(0, 500), last_error_at: new Date().toISOString() },
      )
      .eq('business_id', a.business_id)
  })()

  await Promise.all([toSalon, toCustomer])
}

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'))
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return json({ ok: false, code: 'INVALID_REQUEST' }, 405, headers)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, code: 'INVALID_REQUEST' }, 400, headers)
  }

  // honeypot: a hidden field real people never fill
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ ok: false, code: 'INVALID_REQUEST' }, 400, headers)
  }
  const { businessId, serviceId, staffId, startsAt, name, phone, note, tgInitData } = body
  const valid =
    typeof businessId === 'string' &&
    UUID.test(businessId) &&
    typeof serviceId === 'string' &&
    UUID.test(serviceId) &&
    typeof staffId === 'string' &&
    UUID.test(staffId) &&
    typeof startsAt === 'string' &&
    !Number.isNaN(Date.parse(startsAt)) &&
    typeof name === 'string' &&
    name.length <= 200 &&
    typeof phone === 'string' &&
    phone.length <= 30 &&
    (note === undefined || note === null || (typeof note === 'string' && note.length <= 1000)) &&
    (tgInitData === undefined ||
      tgInitData === null ||
      (typeof tgInitData === 'string' && tgInitData.length <= 4096))
  if (!valid) return json({ ok: false, code: 'INVALID_REQUEST' }, 400, headers)

  const key = serverKey()
  if (!key) return json({ ok: false, code: 'SERVER_CONFIG' }, 500, headers)
  const salt = Deno.env.get('IP_HASH_SALT') || key

  // Mini App: the request must carry initData signed by Telegram for OUR bot. Then the
  // per-requester limit counts the Telegram user (more precise than a shared mobile IP).
  let requester: string
  let tgChatId: number | null = null
  if (typeof tgInitData === 'string' && tgInitData) {
    const token = botToken()
    const tgUser = token ? await verifyInitData(tgInitData, token) : null
    if (!tgUser) return json({ ok: false, code: 'TELEGRAM_AUTH' }, 401, headers)
    requester = `tg:${tgUser}`
    tgChatId = Number(tgUser)
  } else {
    // Client IP: Supabase's gateway puts the real caller IP FIRST in X-Forwarded-For.
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    requester = `ip:${ip}`
    // Web captcha (M7): enforced only once TURNSTILE_SECRET_KEY is set.
    const captchaSecret = Deno.env.get('TURNSTILE_SECRET_KEY')?.trim()
    if (captchaSecret) {
      const token = typeof body.captchaToken === 'string' ? body.captchaToken : ''
      if (!token || token.length > 4096)
        return json({ ok: false, code: 'CAPTCHA_FAILED' }, 403, headers)
      const form = new FormData()
      form.append('secret', captchaSecret)
      form.append('response', token)
      if (ip !== 'unknown') form.append('remoteip', ip)
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: form,
      }).catch(() => null)
      const out = (await res?.json().catch(() => null)) as { success?: boolean } | null
      if (!out?.success) return json({ ok: false, code: 'CAPTCHA_FAILED' }, 403, headers)
    }
  }
  // only a salted hash is stored (never the raw IP / Telegram id)
  const requesterHash = await sha256(`${salt}:${requester}`)

  const admin = adminClient()
  const { data, error } = await admin.rpc('create_booking', {
    p_business_id: businessId,
    p_service_id: serviceId,
    p_staff_id: staffId,
    p_starts_at: startsAt,
    p_customer_name: name.trim().replace(/\s+/g, ' '),
    p_customer_phone: phone,
    p_customer_note: typeof note === 'string' && note.trim() ? note.trim() : null,
    p_ip_hash: requesterHash,
  })
  if (error) {
    console.error('create_booking failed', error.message)
    return json({ ok: false, code: 'SERVER_ERROR' }, 500, headers)
  }
  if (!data?.ok) return json(data, HTTP_STATUS[data?.code] ?? 400, headers)

  // Telegram message in the background: the customer gets the answer immediately
  const sent = notify(data.appointment.id, tgChatId).catch((e) => console.error('notify failed', e))
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(sent)
  else await sent
  return json(data, 201, headers)
})
