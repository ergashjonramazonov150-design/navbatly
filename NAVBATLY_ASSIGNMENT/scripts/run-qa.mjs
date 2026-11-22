// Navbatly QA run through the official Playwright MCP server (configured in .mcp.json).
//   node test-results/run-qa.mjs                      → tests https://navbatly.vercel.app
//   QA_BASE=http://localhost:5173 node test-results/run-qa.mjs   → tests a local dev server
// Every browser action below is an MCP `tools/call` (browser_navigate, browser_click, …).
// Results → test-results/qa-results.json, screenshots → test-results/screenshots/.
// SAFETY: no login is used, and the one "valid booking" is answered by a MOCKED server
// response (route intercepted in the browser), so no real appointment is ever created.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { McpClient } from './mcp-client.mjs'

const BASE = process.env.QA_BASE ?? 'https://navbatly.vercel.app'
const ROOT = resolve(import.meta.dirname, '..')
const SHOTS = 'test-results/screenshots'
const OUT = join(tmpdir(), 'navbatly-playwright-mcp') // MCP snapshot/log files (not kept)
mkdirSync(join(ROOT, SHOTS), { recursive: true })

const mcp = await McpClient.start(['--headless', '--output-dir', OUT], { root: ROOT })
const results = []
const started = new Date().toISOString()

/* ------------------------------ helpers (all via MCP tools) ------------------------------ */
class Blocked extends Error {}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg)
}
function resultOf(text) {
  const m = text.match(/### Result\n([\s\S]*?)(\n### |$)/)
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return m[1].trim()
  }
}
const nav = (path) => mcp.call('browser_navigate', { url: BASE + path })
const js = async (fn) => resultOf(await mcp.call('browser_evaluate', { function: fn }))
const run = async (code) => resultOf(await mcp.call('browser_run_code_unsafe', { code }))
const waitText = (text, time = 20) => mcp.call('browser_wait_for', { text, time })
const resize = (width, height) => mcp.call('browser_resize', { width, height })
const shot = (file, fullPage = false) =>
  mcp.call('browser_take_screenshot', { filename: `${SHOTS}/${file}`, fullPage, scale: 'css' })
async function snapshot() {
  const text = await mcp.call('browser_snapshot', {})
  const file = text.match(/\[Snapshot\]\(([^)]+)\)/)?.[1]
  if (!file) return text
  return readFileSync(isAbsolute(file) ? file : join(ROOT, file), 'utf8')
}
/** element reference from the accessibility snapshot: role + (part of) its accessible name */
async function ref(role, namePart) {
  const snap = await snapshot()
  const esc = namePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const line = snap
    .split('\n')
    // YAML: an entry whose name contains ": " is wrapped in single quotes → optional '
    .find((l) => new RegExp(`- '?${role} "[^"]*${esc}`, 'i').test(l) && /\[ref=/.test(l))
  if (!line) throw new Error(`no ${role} "${namePart}" in the accessibility snapshot`)
  return line.match(/\[ref=([^\]]+)\]/)[1]
}
const click = async (role, name) =>
  mcp.call('browser_click', { element: `${role} "${name}"`, target: await ref(role, name) })
const type = async (role, name, text) =>
  mcp.call('browser_type', { element: `${role} "${name}"`, target: await ref(role, name), text })
const overflow = () =>
  js('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
const bodyText = () => js('() => document.body.innerText')

async function tc(id, area, title, fn) {
  const t0 = Date.now()
  try {
    const evidence = await fn()
    results.push({ id, area, title, status: 'PASS', evidence, ms: Date.now() - t0 })
  } catch (e) {
    const status = e instanceof Blocked ? 'BLOCKED' : 'FAIL'
    results.push({ id, area, title, status, evidence: e.message, ms: Date.now() - t0 })
  }
  const r = results.at(-1)
  console.log(`${r.status.padEnd(7)} ${id} ${title}`)
}
const notTested = (id, area, title, reason) => {
  results.push({ id, area, title, status: 'NOT TESTED', evidence: reason })
  console.log(`NOT TESTED ${id} ${title}`)
}

/* ------------------------------------ HOMEPAGE ------------------------------------ */
await resize(1440, 900)

await tc(
  'TC-01',
  'Homepage',
  'Homepage loads with title, headline, navigation and CTAs',
  async () => {
    await nav('/')
    await waitText("Mijozlar o'zi")
    const info = await js(`() => ({
    title: document.title,
    h1: document.querySelector('h1')?.innerText.replace(/\\s+/g, ' '),
    navLinks: [...document.querySelectorAll('header a')].map(a => a.innerText.trim()).filter(Boolean),
    sections: document.querySelectorAll('main > section').length,
  })`)
    expect(info.title === 'Navbatly', `title is "${info.title}"`)
    expect(/Mijozlar o'zi yozilsin/.test(info.h1), `h1 is "${info.h1}"`)
    expect(info.sections >= 5, `only ${info.sections} sections`)
    await shot('01-homepage.png')
    await shot('01b-homepage-full-page.png', true)
    return `title "${info.title}"; h1 "${info.h1}"; ${info.sections} sections; header links: ${info.navLinks.join(' | ')}`
  },
)

await tc('TC-02', 'Navigation', 'Header menu links scroll to their sections', async () => {
  await nav('/')
  await waitText("Mijozlar o'zi")
  const out = []
  for (const [name, hash] of [
    ['Qanday ishlaydi', '#qanday'],
    ['Imkoniyatlar', '#imkoniyatlar'],
    ['Boshqaruv paneli', '#panel'],
  ]) {
    await click('link', name)
    await mcp.call('browser_wait_for', { time: 1 })
    const r = await js(`() => ({ hash: location.hash,
      top: Math.round(document.querySelector('${hash}').getBoundingClientRect().top) })`)
    expect(r.hash === hash, `"${name}" → hash ${r.hash}`)
    expect(
      r.top > -10 && r.top < 300,
      `"${name}" section top at ${r.top}px (not scrolled into view)`,
    )
    out.push(`${name} → ${r.hash} (section top ${r.top}px)`)
  }
  return out.join('; ')
})

await tc(
  'TC-02b',
  'Navigation',
  'After a menu jump, the section label is not hidden behind the sticky header',
  async () => {
    await nav('/')
    await waitText("Mijozlar o'zi")
    const out = []
    const hidden = []
    for (const [name, hash] of [
      ['Qanday ishlaydi', '#qanday'],
      ['Imkoniyatlar', '#imkoniyatlar'],
      ['Boshqaruv paneli', '#panel'],
    ]) {
      await click('link', name)
      await mcp.call('browser_wait_for', { time: 1 })
      // the small label above the heading = first element in the section with visible text
      const r = await js(`() => {
      const header = document.querySelector('header').getBoundingClientRect()
      const sec = document.querySelector('${hash}')
      const label = [...sec.querySelectorAll('*')].find(el => el.children.length === 0 && el.innerText?.trim())
      const box = label.getBoundingClientRect()
      return { headerBottom: Math.round(header.bottom), labelTop: Math.round(box.top), label: label.innerText.trim(),
               onTop: document.elementFromPoint(box.left + 2, box.top + box.height / 2)?.closest('header') ? 'header' : 'label' }
    }`)
      out.push(
        `${name}: label "${r.label}" top ${r.labelTop}px, header bottom ${r.headerBottom}px, visible element at that point: ${r.onTop}`,
      )
      if (r.onTop === 'header' || r.labelTop < r.headerBottom) hidden.push(name)
      if (hash === '#panel') await shot('02-menu-jump-boshqaruv-paneli.png')
    }
    expect(
      hidden.length === 0,
      `label covered by the sticky header for: ${hidden.join(', ')} — ${out.join('; ')}`,
    )
    return out.join('; ')
  },
)

await tc(
  'TC-03',
  'Navigation',
  'All internal links open real pages; external links are well-formed',
  async () => {
    const links = new Map()
    for (const [path, text] of [
      ['/', "Mijozlar o'zi"],
      ['/privacy', 'Maxfiylik siyosati'],
    ]) {
      await nav(path)
      await waitText(text) // the page must be rendered before its links are collected
      const found = await js(
        `() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'))`,
      )
      expect(found.length > 0, `no links found on ${path}`)
      for (const h of found) links.set(h, path)
    }
    const internal = [...links.keys()].filter((h) => h.startsWith('/'))
    expect(internal.length >= 3, `only ${internal.length} internal links collected`)
    const external = [...links.keys()].filter((h) => /^https?:/.test(h))
    const anchors = [...links.keys()].filter((h) => h.startsWith('#'))
    const broken = []
    for (const path of internal) {
      await nav(path)
      await mcp.call('browser_wait_for', { time: 2 })
      const text = await bodyText()
      if (/Sahifa topilmadi|Salon topilmadi/.test(text) || text.trim().length < 20)
        broken.push(path)
    }
    expect(broken.length === 0, `broken internal links: ${broken.join(', ')}`)
    const badExternal = external.filter((u) => !u.startsWith('https://t.me/navbatly_uz_bot'))
    expect(badExternal.length === 0, `unexpected external links: ${badExternal.join(', ')}`)
    return `internal pages opened OK: ${internal.join(', ')}; in-page anchors: ${anchors.join(', ')}; external (checked, not opened): ${external.join(', ')}`
  },
)

await tc(
  'TC-04',
  'Navigation',
  'Hero CTA "Demo salonni ochish" opens the demo salon booking page',
  async () => {
    await nav('/')
    await waitText("Mijozlar o'zi")
    await click('link', 'Demo salonni ochish')
    await waitText('Xizmatni tanlang')
    const url = await js('() => location.pathname')
    expect(url === '/b/demo', `CTA went to ${url}`)
    return `CTA → ${url}, booking step 1 "Xizmatni tanlang" shown`
  },
)

await tc('TC-05', 'Navigation', 'Privacy page shows all sections and links back home', async () => {
  await nav('/privacy')
  await waitText('Maxfiylik siyosati')
  const r = await js(
    `() => ({ h1: document.querySelector('h1')?.innerText, h2: document.querySelectorAll('h2').length })`,
  )
  expect(r.h2 === 6, `${r.h2} sections instead of 6`)
  await click('link', 'Bosh sahifa')
  await waitText("Mijozlar o'zi")
  const path = await js('() => location.pathname')
  expect(path === '/', `back link went to ${path}`)
  return `h1 "${r.h1}", ${r.h2} sections, back link → ${path}`
})

await tc(
  'TC-06',
  'Navigation',
  'Unknown page and unknown salon show friendly "not found" pages',
  async () => {
    await nav('/this-page-does-not-exist')
    await waitText('Sahifa topilmadi')
    await shot('10-not-found-page.png')
    await nav('/b/no-such-salon-qa')
    await waitText('Salon topilmadi')
    return 'unknown URL → "Sahifa topilmadi" with a link home; unknown salon slug → "Salon topilmadi"'
  },
)

await tc(
  'TC-07',
  'Security',
  'Admin pages require login (logged-out visitor is redirected)',
  async () => {
    await nav('/admin/appointments')
    await waitText('Boshqaruv paneli')
    const path = await js('() => location.pathname')
    expect(path === '/admin/login', `stayed on ${path}`)
    return `/admin/appointments → ${path}`
  },
)

await tc(
  'TC-08',
  'Forms',
  'Admin login form: empty and invalid email are rejected before any request',
  async () => {
    await nav('/admin/login')
    await waitText('Kirish')
    await click('button', 'Kirish')
    await waitText('Emailni kiriting.')
    const t1 = await bodyText()
    expect(t1.includes('Parolni kiriting.'), 'no "password required" message')
    await type('textbox', 'Email', 'not-an-email')
    await click('button', 'Kirish')
    await waitText("Email noto'g'ri ko'rinishda")
    await shot('09-admin-login-validation.png')
    const net = await mcp.call('browser_network_requests', {
      static: false,
      filter: 'auth/v1/token',
    })
    expect(!/auth\/v1\/token/.test(net.replace(/Note:.*$/s, '')), 'a login request was sent')
    return 'empty → "Emailni kiriting." + "Parolni kiriting."; "not-an-email" → "Email noto\'g\'ri ko\'rinishda"; no request to /auth/v1/token'
  },
)

/* ------------------------------------ SALONS ------------------------------------ */
notTested(
  'TC-09',
  'Barbershops',
  'Barbershop listing page',
  'Navbatly has no public salon list: every salon shares its own link /b/<slug> (router has no listing route; a public catalog is planned for Phase 3 in docs/ARCHITECTURE.md). The demo salon page is tested instead (TC-10).',
)

let apiServices = null
await tc(
  'TC-10',
  'Barbershops',
  'Salon page (desktop): name, address, opening hours, barbers, gallery',
  async () => {
    await resize(1440, 900)
    // reload while listening, so the services the API returned can be compared with the page
    await nav('/b/demo')
    apiServices = await run(`async (page) => {
    const [resp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/rest/v1/services') && r.request().method() === 'GET'),
      page.reload(),
    ])
    return (await resp.json()).map(s => ({ name: s.name, price: s.price_uzs, minutes: s.duration_minutes }))
  }`)
    await waitText('Xizmatni tanlang')
    await waitText('Ish vaqti')
    const info = await js(`() => {
    const h2 = document.querySelector('h2')?.innerText
    const hours = [...document.querySelectorAll('dl > div')].map(d => d.innerText.replace(/\\s+/g, ' '))
    const barbers = [...document.querySelectorAll('#barbers-title ~ ul li')].map(li => li.querySelector('span span')?.innerText)
    const gallery = document.querySelectorAll('#works-desktop-title').length
      ? document.querySelectorAll('section[aria-labelledby="works-desktop-title"] img').length : 0
    return { h2, hours, barbers, gallery, phone: !!document.querySelector('a[href^="tel:"]') }
  }`)
    expect(info.h2, 'no salon name heading')
    expect(info.hours.length === 7, `${info.hours.length} weekday rows`)
    expect(info.barbers.length > 0, 'no barbers listed')
    await shot('03-barbershop-details.png')
    await shot('03b-barbershop-details-full-page.png', true)
    return `"${info.h2}"; hours: ${info.hours.join(' / ')}; barbers: ${info.barbers.join(', ')}; gallery photos: ${info.gallery}; call link: ${info.phone}`
  },
)

await tc(
  'TC-11',
  'Barbershops',
  'Services show name, duration and price, matching the API data',
  async () => {
    const shown = await js(
      `() => [...document.querySelectorAll('main ul button[aria-pressed]')].map(b => b.innerText.replace(/\\s+/g, ' '))`,
    )
    expect(shown.length > 0, 'no services on the page')
    expect(Array.isArray(apiServices), 'API response was not captured')
    const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    const problems = []
    for (const s of apiServices) {
      const card = shown.find((t) => t.startsWith(s.name))
      if (!card) problems.push(`${s.name}: missing`)
      else if (!card.includes(`${fmt(s.price)} so'm`) || !card.includes(`${s.minutes} daq`))
        problems.push(`${s.name}: shows "${card}"`)
    }
    expect(
      shown.length === apiServices.length,
      `${shown.length} cards vs ${apiServices.length} services from API`,
    )
    expect(problems.length === 0, problems.join('; '))
    return apiServices.map((s) => `${s.name} — ${fmt(s.price)} so'm, ${s.minutes} daq`).join('; ')
  },
)

/* ------------------------------------ BOOKING ------------------------------------ */
let firstService = null
await tc(
  'TC-12',
  'Booking',
  'Step 1 → 2: "Davom etish" disabled until a service is chosen; barbers filtered',
  async () => {
    const disabled = await js(
      `() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Davom etish')?.disabled`,
    )
    expect(disabled === true, '"Davom etish" is enabled before choosing a service')
    firstService = apiServices[0].name
    await click('button', firstService)
    await click('button', 'Davom etish')
    await waitText('Ustani tanlang')
    await mcp.call('browser_wait_for', { time: 3 }) // "Eng yaqin" free times load per barber
    const barbers = await js(
      `() => [...document.querySelectorAll('main ul button[aria-pressed]')].map(b => b.innerText.replace(/\\s+/g, ' '))`,
    )
    expect(barbers.length > 0, 'no barber offered for the service')
    await shot('04a-booking-barber-step.png')
    return `service "${firstService}" → barbers offered: ${barbers.join(' | ')}`
  },
)

let slotLabel = null
await tc('TC-13', 'Booking', 'Step 2 → 3 → 4: choose barber, day and a free time', async () => {
  const barber = await js(
    `() => [...document.querySelectorAll('main ul button[aria-pressed]')].find(b => /Eng yaqin/.test(b.innerText))?.innerText.split('\\n')[0].trim()`,
  )
  if (!barber)
    throw new Blocked(
      'no barber has a free time in the next 7 days, so the time step cannot be reached',
    )
  await click('button', barber)
  await click('button', 'Davom etish')
  await waitText('Kun va vaqtni tanlang')
  await mcp.call('browser_wait_for', { time: 2 })
  const slots = await js(
    `() => [...document.querySelectorAll('main button[aria-pressed]')].map(b => b.innerText.trim()).filter(t => /^\\d\\d:\\d\\d$/.test(t))`,
  )
  expect(slots.length > 0, 'no free times on the chosen day')
  slotLabel = slots[0]
  await click('button', slotLabel)
  await shot('04b-booking-time-step.png')
  await click('button', 'Davom etish')
  await waitText("Ma'lumotlaringiz")
  await shot('04-booking-form.png')
  return `barber "${barber}", ${slots.length} free times shown, picked ${slotLabel} → contact form`
})

await tc(
  'TC-14',
  'Booking',
  'Empty form submission shows all required-field errors and sends nothing',
  async () => {
    if (!slotLabel) throw new Blocked('contact form not reached (TC-13)')
    await click('button', 'Band qilish')
    await waitText('Ismingizni kiriting (kamida 2 ta harf).')
    const t = await bodyText()
    expect(t.includes("Raqamni to'liq kiriting"), 'no phone error')
    expect(t.includes("Davom etish uchun rozilik belgisini qo'ying."), 'no consent error')
    const net = await mcp.call('browser_network_requests', {
      static: false,
      filter: 'create-booking',
    })
    expect(!/create-booking/.test(net.replace(/Note:.*$/s, '')), 'a booking request was sent')
    await shot('05-form-validation.png')
    return 'name, phone and consent errors shown; no request to create-booking'
  },
)

await tc(
  'TC-15',
  'Booking',
  'Invalid input: 1-letter name, short phone, letters in phone',
  async () => {
    if (!slotLabel) throw new Blocked('contact form not reached (TC-13)')
    await type('textbox', 'Ismingiz', 'A')
    await type('textbox', 'Telefon raqamingiz', 'abc12345')
    const phone = await js(`() => document.querySelector('input[type=tel]').value`)
    expect(!/[a-z]/i.test(phone), `phone field accepted letters: "${phone}"`)
    await click('button', 'Band qilish')
    const t = await bodyText()
    expect(t.includes('Ismingizni kiriting (kamida 2 ta harf).'), '1-letter name accepted')
    expect(t.includes("Raqamni to'liq kiriting"), '5-digit phone accepted')
    await shot('05b-form-invalid-input.png')
    return `name "A" rejected; phone typed "abc12345" kept as "${phone}" (letters dropped) and rejected as too short`
  },
)

await tc(
  'TC-16',
  'Booking',
  'Valid booking → confirmation screen (server answer MOCKED, nothing saved)',
  async () => {
    if (!slotLabel) throw new Blocked('contact form not reached (TC-13)')
    const t0 = await bodyText()
    if (/challenges\.cloudflare|Turnstile/i.test(t0))
      throw new Blocked('captcha is switched on; it cannot be solved by automation')
    // intercept the create-booking call INSIDE the browser: the request never reaches the server
    await run(`async (page) => {
    await page.route('**/functions/v1/create-booking', async (route) => {
      const body = route.request().postDataJSON()
      await page.evaluate((b) => { window.__qaIntercepted = b }, body)
      await route.fulfill({ status: 201, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ ok: true, appointment: { id: '00000000-0000-0000-0000-000000000000', status: 'pending', starts_at: body.startsAt } }) })
    })
    return 'mock installed'
  }`)
    await mcp.call('browser_fill_form', {
      fields: [
        {
          name: 'Ismingiz',
          type: 'textbox',
          target: await ref('textbox', 'Ismingiz'),
          value: 'QA Test',
        },
        {
          name: 'Telefon raqamingiz',
          type: 'textbox',
          target: await ref('textbox', 'Telefon raqamingiz'),
          value: '900000099',
        },
      ],
    })
    await click('checkbox', 'Shaxsiy')
    await click('button', 'Band qilish')
    const after = await bodyText()
    if (after.includes('Tasdiqlash uchun') && /captcha|robot/i.test(after))
      throw new Blocked('captcha required')
    await waitText("So'rovingiz yuborildi!")
    const sent = await js('() => window.__qaIntercepted')
    expect(
      sent && sent.phone === '+998900000099' && sent.name === 'QA Test',
      `request body: ${JSON.stringify(sent)}`,
    )
    expect(sent.website === '', 'honeypot field not empty')
    await shot('06-booking-confirmation.png')
    await run(`async (page) => { await page.unrouteAll(); return 'mock removed' }`)
    return `confirmation "So'rovingiz yuborildi!" shown; intercepted request: service ${sent.serviceId.slice(0, 8)}…, barber ${sent.staffId.slice(0, 8)}…, time ${sent.startsAt}, name "${sent.name}", phone ${sent.phone}, honeypot empty. Request was answered by the mock — no appointment created.`
  },
)

/* ------------------------------------ RESPONSIVE ------------------------------------ */
const viewports = [
  ['desktop', 1440, 900],
  ['tablet', 768, 1024],
  ['tablet-landscape', 1024, 768],
  ['mobile', 390, 844],
]
for (const [name, w, h] of viewports) {
  await tc(
    `TC-17-${name}`,
    'Responsive',
    `${name} ${w}×${h}: homepage and salon page fit without sideways scrolling`,
    async () => {
      await resize(w, h)
      await nav('/')
      await waitText("Mijozlar o'zi")
      const o1 = await overflow()
      await shot(`07-${name}-homepage.png`)
      await nav('/b/demo')
      await waitText('Xizmatni tanlang')
      await mcp.call('browser_wait_for', { time: 2 })
      const o2 = await overflow()
      const layout = await js(
        `() => document.querySelector('#hours-title') ? 'two columns (info panel + booking card)' : 'single column'`,
      )
      await shot(`07-${name}-salon-page.png`)
      expect(o1 <= 0 && o2 <= 0, `horizontal overflow: homepage ${o1}px, salon page ${o2}px`)
      const expected = w >= 1024 ? 'two columns' : 'single column'
      expect(layout.startsWith(expected), `layout is "${layout}", expected ${expected}`)
      return `no horizontal overflow (homepage ${o1}px, salon ${o2}px); salon layout: ${layout}`
    },
  )
}

/* ------------------------------------ ERRORS ------------------------------------ */
await tc('TC-18', 'Browser errors', 'No console errors during the whole session', async () => {
  const text = await mcp.call('browser_console_messages', { level: 'error', all: true })
  const m = text.match(/Errors: (\d+)/)
  const errors = m ? Number(m[1]) : NaN
  expect(errors === 0, `console errors:\n${text.slice(0, 1500)}`)
  return text.match(/Total messages[^\n]*/)?.[0] ?? text.slice(0, 200)
})

await tc('TC-19', 'Browser errors', 'No failed network requests on clean page loads', async () => {
  // Each page is loaded on its own and left to finish, then ITS requests are checked.
  // (Over the whole scripted session some requests show net::ERR_ABORTED: the browser
  // cancels in-flight requests when the test navigates away — counted below, not failures.)
  await resize(1440, 900)
  const out = []
  const failed = []
  for (const [path, text] of [
    ['/', "Mijozlar o'zi"],
    ['/b/demo', 'Ish vaqti'],
    ['/privacy', 'Maxfiylik siyosati'],
    ['/admin/login', 'Kirish'],
  ]) {
    await nav(path)
    await waitText(text)
    await mcp.call('browser_wait_for', { time: 4 }) // lazy images and data requests finish
    const list = await mcp.call('browser_network_requests', { static: true })
    const lines = list.split('\n').filter((l) => /^\d+\. \[/.test(l))
    failed.push(
      ...lines
        .filter((l) => /=> \[(4|5)\d\d\]|FAILED|net::ERR/i.test(l))
        .map((l) => `${path}: ${l}`),
    )
    out.push(`${path}: ${lines.length} requests`)
  }
  const all = await mcp.call('browser_network_requests', { static: true, all: true })
  const aborted = all.split('\n').filter((l) => /ERR_ABORTED/.test(l)).length
  expect(failed.length === 0, `failed requests:\n${failed.join('\n')}`)
  return `${out.join('; ')} — 0 with status 4xx/5xx or network errors. Whole session: ${aborted} request(s) net::ERR_ABORTED (cancelled by navigation during the scripted run).`
})

notTested(
  'TC-20',
  'Admin',
  'Admin panel after login (bookings, calendar, services, barbers, settings)',
  "Requires owner credentials. Per the assignment restrictions no credentials were used. Access control (TC-07) and form validation (TC-08) were tested; the panel itself is covered by the project's automated component tests (see report).",
)
notTested(
  'TC-21',
  'Telegram',
  'Telegram bot and Mini App booking',
  'Requires the Telegram app and a real Telegram account; cannot be driven by Playwright. Bot links were checked for correct format (TC-03).',
)

await mcp.close()
const summary = Object.fromEntries(
  ['PASS', 'FAIL', 'BLOCKED', 'NOT TESTED'].map((s) => [
    s,
    results.filter((r) => r.status === s).length,
  ]),
)
writeFileSync(
  join(ROOT, 'test-results/qa-results.json'),
  JSON.stringify(
    {
      base: BASE,
      started,
      finished: new Date().toISOString(),
      server: mcp.serverInfo?.serverInfo,
      summary,
      results,
      toolCalls: mcp.log.length,
    },
    null,
    2,
  ),
)
console.log('\nsummary:', JSON.stringify(summary), `| MCP tool calls: ${mcp.log.length}`)
process.exit(0)
