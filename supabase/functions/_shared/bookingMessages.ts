// Telegram texts for a new booking — pure functions, no imports, so they run in Deno (Edge
// Functions) AND in Node (unit test: bookingMessages.test.ts).
//   salonMessage    → the salon's linked chat (M6)
//   customerMessage → the customer's OWN chat, only for Mini App bookings (verified user id)

export type BookingInfo = {
  customer_name: string
  customer_phone: string
  customer_note: string | null
  starts_at: string
  status: string
  price_uzs: number
  services: { name: string; duration_minutes: number } | null
  staff: { full_name: string } | null
  businesses: {
    name: string
    timezone: string
    phone: string | null
    address: string | null
  } | null
}

const MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
]
const WEEKDAYS: Record<string, string> = {
  Mon: 'dushanba',
  Tue: 'seshanba',
  Wed: 'chorshanba',
  Thu: 'payshanba',
  Fri: 'juma',
  Sat: 'shanba',
  Sun: 'yakshanba',
}

/** HTML-escape for Telegram parse_mode=HTML */
export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const money = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`
export const phoneFmt = (p: string) =>
  p.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4')

/** "15-noyabr, shanba, 10:00" in the salon's timezone */
export function whenUz(iso: string, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      day: 'numeric',
      month: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  )
  return `${parts.day}-${MONTHS[Number(parts.month) - 1]}, ${WEEKDAYS[parts.weekday] ?? ''}, ${parts.hour}:${parts.minute}`
}

const tzOf = (a: BookingInfo) => a.businesses?.timezone ?? 'Asia/Tashkent'
const serviceLine = (a: BookingInfo) =>
  `✂️ ${esc(a.services?.name ?? '')} (${a.services?.duration_minutes ?? '?'} daq) — ${money(a.price_uzs)}`

export function salonMessage(a: BookingInfo, viaTelegram: boolean) {
  const lines = [
    `🆕 <b>Yangi yozilish — ${esc(a.businesses?.name ?? '')}</b>`,
    `👤 ${esc(a.customer_name)}, ${esc(phoneFmt(a.customer_phone))}`,
    serviceLine(a),
    `💈 Usta: ${esc(a.staff?.full_name ?? '')}`,
    `🗓 ${whenUz(a.starts_at, tzOf(a))}`,
    `Holat: ${a.status === 'confirmed' ? 'tasdiqlangan ✅' : 'tasdiqlash kutilmoqda ⏳'}`,
  ]
  if (a.customer_note) lines.push(`💬 ${esc(a.customer_note)}`)
  if (viaTelegram) lines.push('📱 Telegram orqali yozildi')
  return lines.join('\n')
}

/** Short confirmation for the customer: salon, service, barber, date/time, status. */
export function customerMessage(a: BookingInfo) {
  const confirmed = a.status === 'confirmed'
  const b = a.businesses
  const lines = [
    confirmed
      ? `✅ <b>Siz yozildingiz — ${esc(b?.name ?? '')}</b>`
      : `📨 <b>So'rovingiz yuborildi — ${esc(b?.name ?? '')}</b>`,
    serviceLine(a),
    `💈 Usta: ${esc(a.staff?.full_name ?? '')}`,
    `🗓 ${whenUz(a.starts_at, tzOf(a))}`,
    `Holat: ${confirmed ? 'tasdiqlangan ✅' : 'salon tasdiqlashi kutilmoqda ⏳'}`,
  ]
  if (b?.address) lines.push(`📍 ${esc(b.address)}`)
  if (b?.phone) lines.push(`📞 ${esc(phoneFmt(b.phone))}`)
  lines.push(
    '',
    "Bekor qilish yoki vaqtni o'zgartirish uchun salonga qo'ng'iroq qiling. To'lov salonda.",
  )
  return lines.join('\n')
}
