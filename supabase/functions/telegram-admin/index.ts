// telegram-admin — owner-only actions from Sozlamalar (needs the owner's login token):
//   { action: 'setup', businessId }  → make sure Telegram sends updates to our webhook
//                                      (idempotent; called before "Botni ulash")
//   { action: 'test',  businessId }  → send "Sinov xabari" to the linked chat
// The owner check is done here with the user's JWT + the database (owner of an ACTIVE salon).
import { APP_URL, adminClient, botToken, tg, webhookSecret } from '../_shared/telegram.ts'

const ORIGINS = [
  /^https:\/\/navbatly\.vercel\.app$/,
  /^https:\/\/navbatly-[a-z0-9-]+\.vercel\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^http:\/\/(10|192\.168)\.[0-9.]+(:\d+)?$/,
]
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ORIGINS.some((r) => r.test(origin)) ? origin : APP_URL,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  Vary: 'Origin',
})
const json = (b: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(b), { status, headers: { ...h, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'))
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return json({ ok: false, code: 'INVALID_REQUEST' }, 405, headers)

  const token = botToken()
  if (!token) return json({ ok: false, code: 'BOT_NOT_CONFIGURED' }, 500, headers)

  const body = (await req.json().catch(() => ({}))) as { action?: string; businessId?: string }
  const db = adminClient()

  // who is calling? (the owner's access token from the admin panel)
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await db.auth.getUser(jwt)
  if (!auth?.user || typeof body.businessId !== 'string')
    return json({ ok: false, code: 'NOT_ALLOWED' }, 401, headers)
  const { data: member } = await db
    .from('business_members')
    .select('role, businesses!inner(is_active)')
    .eq('user_id', auth.user.id)
    .eq('business_id', body.businessId)
    .eq('role', 'owner')
    .eq('businesses.is_active', true)
    .maybeSingle()
  if (!member) return json({ ok: false, code: 'NOT_ALLOWED' }, 403, headers)

  if (body.action === 'setup') {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-webhook`
    const r = await tg(token, 'setWebhook', {
      url,
      secret_token: await webhookSecret(token),
      allowed_updates: ['message'],
    })
    if (!r.ok) return json({ ok: false, code: 'TELEGRAM_ERROR', detail: r.error }, 502, headers)
    // the bot is shared by all salons: no salon-specific global menu button
    await tg(token, 'setChatMenuButton', { menu_button: { type: 'commands' } })
    await tg(token, 'setMyCommands', {
      commands: [{ command: 'start', description: 'Botni ishga tushirish' }],
    })
    return json({ ok: true }, 200, headers)
  }

  if (body.action === 'test') {
    const { data: s } = await db
      .from('business_telegram_settings')
      .select('chat_id, is_enabled')
      .eq('business_id', body.businessId)
      .maybeSingle()
    if (!s?.chat_id) return json({ ok: false, code: 'NOT_LINKED' }, 400, headers)
    const r = await tg(token, 'sendMessage', {
      chat_id: s.chat_id,
      text: '✅ Sinov xabari — Navbatly.\nYangi onlayn yozilishlar haqida xabarlar shu chatga keladi.',
    })
    await db
      .from('business_telegram_settings')
      .update(
        r.ok
          ? { last_error: null, last_error_at: null }
          : { last_error: r.error.slice(0, 500), last_error_at: new Date().toISOString() },
      )
      .eq('business_id', body.businessId)
    return r.ok
      ? json({ ok: true }, 200, headers)
      : json({ ok: false, code: 'TELEGRAM_ERROR', detail: r.error }, 502, headers)
  }

  return json({ ok: false, code: 'INVALID_REQUEST' }, 400, headers)
})
