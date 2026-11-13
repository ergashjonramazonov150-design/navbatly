#!/usr/bin/env node
/**
 * Live-site check in a REAL browser (installed Chrome via Playwright):
 * confirms the app actually RENDERS — not just that the server answers HTTP 200.
 *
 * Usage:
 *   npm run check:live                         # production (https://navbatly.vercel.app)
 *   npm run check:live -- http://localhost:5173
 *   npm run check:live -- <url> --expect-config-error   # proves the error screen shows
 *
 * Fails (exit 1) on: missing expected text, a blank page, the configuration error screen,
 * uncaught JavaScript errors, console errors, or horizontal scrolling on a phone screen.
 */
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const BASE = (args.find((a) => a.startsWith('http')) ?? 'https://navbatly.vercel.app').replace(
  /\/$/,
  '',
)
const EXPECT_CONFIG_ERROR = args.includes('--expect-config-error')
const CONFIG_ERROR_TEXT = 'Sayt vaqtincha ishlamayapti'

const CHECKS = [
  { path: '/', expect: ['Salom, Navbatly!'] },
  { path: '/admin/login', expect: ['Boshqaruv paneli', 'Kirish'], selector: 'input#email' },
  // logged out → must END on the login form (redirect works in a real browser)
  { path: '/admin/appointments', expect: ['Boshqaruv paneli'], endsAt: '/admin/login' },
  { path: '/admin/services', expect: ['Boshqaruv paneli'], endsAt: '/admin/login' },
  { path: '/admin/staff', expect: ['Boshqaruv paneli'], endsAt: '/admin/login' },
  { path: '/admin/settings', expect: ['Boshqaruv paneli'], endsAt: '/admin/login' },
  { path: '/admin/forgot-password', expect: ['Parolni tiklash hozircha ishlamayapti'] },
  { path: '/admin/reset-password', expect: ["Havola eskirgan yoki noto'g'ri"] },
]

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800, isMobile: false },
  { name: 'phone', width: 390, height: 844, isMobile: true },
]

let failures = 0
const ok = (msg) => console.log(`ok      ${msg}`)
const fail = (msg) => {
  failures++
  console.log(`not ok  ${msg}`)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      locale: 'uz-UZ',
      timezoneId: 'America/New_York', // a far-away timezone: the app must not depend on it
    })
    const checks = EXPECT_CONFIG_ERROR ? [{ path: '/', expect: [CONFIG_ERROR_TEXT] }] : CHECKS

    for (const c of checks) {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push(`uncaught: ${e.message}`))
      page.on('console', (m) => {
        // the config-error screen logs on purpose; everything else is a bug
        if (
          m.type() === 'error' &&
          !(EXPECT_CONFIG_ERROR && m.text().includes('Invalid configuration'))
        ) {
          errors.push(`console: ${m.text()}`)
        }
      })
      const label = `[${vp.name}] ${c.path}`
      try {
        const res = await page.goto(BASE + c.path, { waitUntil: 'networkidle', timeout: 30_000 })
        if (!res || res.status() >= 400) {
          fail(`${label} HTTP ${res?.status()}`)
          continue
        }
        for (const text of c.expect) {
          await page.getByText(text, { exact: false }).first().waitFor({ timeout: 10_000 })
        }
        if (c.selector) await page.locator(c.selector).waitFor({ state: 'visible', timeout: 5_000 })

        const body = (await page.locator('body').innerText()).trim()
        if (!body) throw new Error('blank page')
        if (!EXPECT_CONFIG_ERROR && body.includes(CONFIG_ERROR_TEXT)) {
          throw new Error('configuration error screen is showing')
        }
        if (c.endsAt && new URL(page.url()).pathname !== c.endsAt) {
          throw new Error(`ended at ${new URL(page.url()).pathname}, expected ${c.endsAt}`)
        }
        if (vp.isMobile) {
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          )
          if (overflow > 1) throw new Error(`horizontal scroll on phone (${overflow}px too wide)`)
        }
        if (errors.length) throw new Error(errors.join(' | '))
        ok(`${label} renders: ${c.expect.map((t) => `"${t}"`).join(', ')}`)
      } catch (e) {
        fail(`${label}: ${e.message.split('\n')[0]}`)
      } finally {
        await page.close()
      }
    }
    await context.close()
  }
} finally {
  await browser.close()
}

console.log(`\n# ${BASE}: ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
