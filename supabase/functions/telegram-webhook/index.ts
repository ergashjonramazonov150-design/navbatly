// telegram-webhook — Telegram calls this for every message to @navbatly_uz_bot.
//
// Security: Telegram sends X-Telegram-Bot-Api-Secret-Token (set by telegram-admin "setup"
// via setWebhook). Requests without the right secret are rejected before anything else.
//
//   /start link_<code>  → owner linking ("Botni ulash"): the one-time code links this chat
//   /start <slug>       → a salon's customer link: reply with a "Yozilish" Mini App button
//   /start              → short welcome
import {
  APP_URL,
  LINK_PREFIX,
  adminClient,
  botToken,
  esc,
  safeEqual,
  tg,
  webhookSecret,
} from '../_shared/telegram.ts'

type Update = {
  message?: {
    text?: string
    chat: {
      id: number
      type: string
      title?: string
      first_name?: string
      last_name?: string
      username?: string
    }
  }
}

const SLUG = /^[a-z0-9-]{3,40}$/

Deno.serve(async (req) => {
  const token = botToken()
  if (!token) return new Response('not configured', { status: 500 })
  const got = req.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? ''
  if (req.method !== 'POST' || !safeEqual(got, await webhookSecret(token))) {
    return new Response('forbidden', { status: 403 })
  }

  let update: Update
  try {
    update = await req.json()
  } catch {
    return new Response('ok') // never make Telegram retry garbage
  }
  const msg = update.message
  const text = msg?.text?.trim() ?? ''
  if (!msg || !text.startsWith('/start')) return new Response('ok')

  const chatId = String(msg.chat.id)
  // "/start" or "/start@navbatly_uz_bot" followed by an optional parameter
  const param = text.split(/\s+/)[1] ?? ''
  const reply = (body: Record<string, unknown>) =>
    tg(token, 'sendMessage', { chat_id: chatId, parse_mode: 'HTML', ...body })
  const db = adminClient()

  if (param.startsWith(LINK_PREFIX)) {
    const fullName = [msg.chat.first_name, msg.chat.last_name].filter(Boolean).join(' ')
    const who =
      msg.chat.title || fullName || (msg.chat.username ? `@${msg.chat.username}` : 'Telegram')
    const { data: salon, error } = await db.rpc('telegram_link_chat', {
      p_code: param.slice(LINK_PREFIX.length),
      p_chat_id: chatId,
      p_chat_title: who,
    })
    if (error) {
      console.error('telegram_link_chat failed', error.message)
      await reply({ text: "⚠️ Xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring." })
    } else if (salon) {
      await reply({
        text: `✅ <b>${esc(salon)}</b> ulandi.\nYangi onlayn yozilishlar haqida xabarlar shu chatga keladi.`,
      })
    } else {
      await reply({
        text: '❌ Havola eskirgan yoki allaqachon ishlatilgan.\nSozlamalarda «Botni ulash» tugmasini qayta bosing.',
      })
    }
    return new Response('ok')
  }

  if (SLUG.test(param)) {
    const { data: biz } = await db
      .from('businesses')
      .select('name, slug, address')
      .eq('slug', param)
      .eq('is_active', true)
      .maybeSingle()
    if (!biz) {
      await reply({ text: 'Salon topilmadi yoki hozircha onlayn yozilish yopiq.' })
      return new Response('ok')
    }
    await reply({
      text: `💈 <b>${esc(biz.name)}</b>${biz.address ? `\n📍 ${esc(biz.address)}` : ''}\n\nXizmat, usta va qulay vaqtni tanlang — bir daqiqada yozilasiz.`,
      reply_markup: {
        inline_keyboard: [[{ text: '✂️ Yozilish', web_app: { url: `${APP_URL}/b/${biz.slug}` } }]],
      },
    })
    return new Response('ok')
  }

  await reply({
    text: 'Salom! 👋 Bu <b>Navbatly</b> — sartaroshxona va salonlarga onlayn yozilish boti.\n\nSalonga yozilish uchun salon bergan havolani oching (masalan, Instagram profilidagi havola).',
  })
  return new Response('ok')
})
