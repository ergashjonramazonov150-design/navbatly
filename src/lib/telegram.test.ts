import { describe, expect, it } from 'vitest'

import { ownerLinkUrl, randomLinkCode, salonBotLink } from './telegram'

// Telegram only accepts /start parameters of up to 64 chars from A-Z a-z 0-9 _ -
const START_PARAM = /^[A-Za-z0-9_-]{1,64}$/
const param = (url: string) => new URL(url).searchParams.get('start') ?? ''

describe('Telegram bot links', () => {
  it('salon link opens the shared bot with the salon slug', () => {
    expect(salonBotLink('demo')).toBe('https://t.me/navbatly_uz_bot?start=demo')
    expect(param(salonBotLink('madara-barbershop'))).toMatch(START_PARAM)
  })

  it('owner link uses the link_ prefix (slugs never contain "_")', () => {
    const code = randomLinkCode()
    expect(ownerLinkUrl(code)).toBe(`https://t.me/navbatly_uz_bot?start=link_${code}`)
    expect(param(ownerLinkUrl(code))).toMatch(START_PARAM)
  })

  it('link codes are 43 url-safe chars and different every time', () => {
    const codes = new Set(Array.from({ length: 50 }, randomLinkCode))
    expect(codes.size).toBe(50)
    for (const c of codes) expect(c).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
})
