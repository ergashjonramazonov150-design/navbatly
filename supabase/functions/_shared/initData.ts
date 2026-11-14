// Telegram Mini App initData check — pure Web Crypto, no imports, so it runs in Deno (Edge
// Functions) AND in Node (unit test: initData.test.ts).
// Bot API "Validating data received via the Mini App":
//   secret = HMAC_SHA256(key = "WebAppData", data = bot_token)
//   hash   = hex(HMAC_SHA256(key = secret, data = data_check_string))
// data_check_string = all fields except "hash", sorted by key, "key=value" lines joined by
// a newline character.

const enc = new TextEncoder()
async function hmac(key: Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Returns the Telegram user id when the data is genuine and fresh, otherwise null. */
export async function verifyInitData(
  initData: string,
  token: string,
  maxAgeSec = 24 * 3600,
  nowSec = Date.now() / 1000,
) {
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
  if (!authDate || nowSec - authDate > maxAgeSec) return null
  try {
    const user = JSON.parse(params.get('user') ?? 'null') as { id?: number } | null
    return user?.id ? String(user.id) : null
  } catch {
    return null
  }
}
