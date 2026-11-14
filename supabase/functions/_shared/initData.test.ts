import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { verifyInitData } from './initData.ts'

// A made-up token (never a real one) — the check must work for any token format.
const TOKEN = '123456:TEST_token_for_unit_tests_only_abcdefghijk'
const NOW = 1_800_000_000

/** Signs initData exactly like Telegram does (independent implementation with node:crypto). */
function sign(fields: Record<string, string>, token = TOKEN) {
  const check = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const hash = createHmac('sha256', secret).update(check).digest('hex')
  return new URLSearchParams({ ...fields, hash }).toString()
}
const user = JSON.stringify({ id: 42, first_name: 'Aziz' })

describe('Telegram Mini App initData check (create-booking anti-spam)', () => {
  it('accepts genuine, fresh data and returns the Telegram user id', async () => {
    const data = sign({ user, auth_date: String(NOW - 60), query_id: 'AAE' })
    expect(await verifyInitData(data, TOKEN, 24 * 3600, NOW)).toBe('42')
  })

  it('rejects a changed field (e.g. someone edits the user id)', async () => {
    const data = sign({ user, auth_date: String(NOW - 60) }).replace('42', '43')
    expect(await verifyInitData(data, TOKEN, 24 * 3600, NOW)).toBeNull()
  })

  it('rejects data signed for ANOTHER bot', async () => {
    const data = sign(
      { user, auth_date: String(NOW - 60) },
      '999:OTHER_bot_token_abcdefghijklmnopqrstuvwx',
    )
    expect(await verifyInitData(data, TOKEN, 24 * 3600, NOW)).toBeNull()
  })

  it('rejects old data (replayed after more than 24 hours)', async () => {
    const data = sign({ user, auth_date: String(NOW - 25 * 3600) })
    expect(await verifyInitData(data, TOKEN, 24 * 3600, NOW)).toBeNull()
  })

  it('rejects missing hash / garbage', async () => {
    expect(
      await verifyInitData(`user=${encodeURIComponent(user)}&auth_date=${NOW}`, TOKEN, 3600, NOW),
    ).toBeNull()
    expect(await verifyInitData('hash=deadbeef', TOKEN, 3600, NOW)).toBeNull()
  })
})
