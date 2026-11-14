// create-booking — the ONLY way a customer (no login) can create a booking.
//
//   browser → this function → public.create_booking() with the server key.
//
// The database function re-checks everything (service/barber active, working hours,
// days off, notice + horizon, max active bookings per phone, per-IP rate limit) and the
// EXCLUDE constraint makes double booking impossible (SLOT_TAKEN).
// MVP note: captcha (Turnstile) comes in M7; the honeypot + DB limits are active now.
// Telegram notification comes in M6.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const ALLOWED_ORIGINS = [
  /^https:\/\/navbatly\.vercel\.app$/,
  /^https:\/\/navbatly-[a-z0-9-]+\.vercel\.app$/, // Vercel preview deployments
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^http:\/\/(10|192\.168)\.[0-9.]+(:\d+)?$/, // dev server on home Wi-Fi (phone tests)
]

function cors(origin: string | null) {
  const ok = origin && ALLOWED_ORIGINS.some((re) => re.test(origin))
  return {
    'Access-Control-Allow-Origin': ok ? origin! : 'https://navbatly.vercel.app',
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

function serverKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    return keys.default ?? Object.values(keys)[0]
  } catch {
    return undefined
  }
}

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
  const { businessId, serviceId, staffId, startsAt, name, phone, note } = body
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
    (note === undefined || note === null || (typeof note === 'string' && note.length <= 1000))
  if (!valid) return json({ ok: false, code: 'INVALID_REQUEST' }, 400, headers)

  // Client IP: Supabase's gateway puts the real caller IP FIRST in X-Forwarded-For.
  // We store only a salted hash (never the raw IP). Documented further in M7.
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const key = serverKey()
  if (!key) return json({ ok: false, code: 'SERVER_CONFIG' }, 500, headers)
  // Salt: a dedicated IP_HASH_SALT secret if set, otherwise the server key (equally secret,
  // never leaves the server, stable) — so the raw IP can't be recovered from the hash.
  const salt = Deno.env.get('IP_HASH_SALT') || key
  const ipHash = await sha256(`${salt}:${ip}`)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await admin.rpc('create_booking', {
    p_business_id: businessId,
    p_service_id: serviceId,
    p_staff_id: staffId,
    p_starts_at: startsAt,
    p_customer_name: name.trim().replace(/\s+/g, ' '),
    p_customer_phone: phone,
    p_customer_note: typeof note === 'string' && note.trim() ? note.trim() : null,
    p_ip_hash: ipHash,
  })
  if (error) {
    console.error('create_booking failed', error.message)
    return json({ ok: false, code: 'SERVER_ERROR' }, 500, headers)
  }
  if (!data?.ok) return json(data, HTTP_STATUS[data?.code] ?? 400, headers)
  return json(data, 201, headers)
})
