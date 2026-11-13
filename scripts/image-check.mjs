#!/usr/bin/env node
/**
 * Checks src/lib/images/process.ts in a REAL browser (installed Chrome via Playwright).
 * Unit tests run in jsdom, which has no image decoding or canvas encoding — so the
 * actual resizing / cropping / WebP-or-JPEG / rotation behaviour is verified here.
 * Test images are generated inside the browser; nothing is uploaded anywhere.
 *
 * Usage: npm run check:images
 */
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls.local[0]

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
await page.goto(base)

const results = await page.evaluate(async () => {
  const m = await import('/src/lib/images/process.ts')
  const out = []
  const check = (name, ok, detail) => out.push({ name, ok: !!ok, detail })

  const makeCanvas = (w, h, paint) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    paint(ctx, w, h)
    return c
  }
  const blobOf = (c, type, q) => new Promise((r) => c.toBlob(r, type, q))
  const gradient = (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#b4532a')
    g.addColorStop(1, '#1f1b16')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  const sizeOf = async (blob) => {
    const b = await createImageBitmap(blob)
    return { w: b.width, h: b.height }
  }
  const errKey = async (p) => {
    try {
      await p
      return 'no error'
    } catch (e) {
      return e.key ?? String(e)
    }
  }

  // 1. big phone-like JPEG → gallery: whole photo ≤ 1600 long side + 400 square
  const big = await blobOf(makeCanvas(4000, 3000, gradient), 'image/jpeg', 0.9)
  const g = await m.processImage(big, 'gallery')
  const gl = await sizeOf(g.lg)
  const gs = await sizeOf(g.sm)
  check('gallery: 4000×3000 → lg 1600×1200', gl.w === 1600 && gl.h === 1200, gl)
  check('gallery: small = 400×400 square', gs.w === 400 && gs.h === 400, gs)
  check('Chrome makes WebP', g.ext === 'webp' && g.lg.type === 'image/webp', g.lg.type)
  check('files are small (lg < 500 KB)', g.lg.size < 500_000, `${Math.round(g.lg.size / 1024)} KB`)

  // 2. cover with an owner-chosen crop area (3:1)
  const coverSrc = await blobOf(makeCanvas(3000, 2000, gradient), 'image/jpeg', 0.9)
  const cv = await m.processImage(coverSrc, 'cover', { x: 0, y: 500, w: 3000, h: 1000 })
  const cl = await sizeOf(cv.lg)
  const cs = await sizeOf(cv.sm)
  check('cover: crop 3000×1000 → lg 1600×533', cl.w === 1600 && cl.h === 533, cl)
  check('cover: sm 800×267', cs.w === 800 && cs.h === 267, cs)

  // 3. wide transparent PNG logo → whole logo inside a cream square
  const logoSrc = await blobOf(
    makeCanvas(900, 300, (ctx) => {
      ctx.fillStyle = '#1f1b16'
      ctx.fillRect(100, 100, 700, 100) // dark "wordmark"; everything else transparent
    }),
    'image/png',
  )
  const lo = await m.processImage(logoSrc, 'logo')
  const ll = await sizeOf(lo.lg)
  const bmp = await createImageBitmap(lo.lg)
  const pc = makeCanvas(bmp.width, bmp.height, (ctx) => ctx.drawImage(bmp, 0, 0))
  const ctx = pc.getContext('2d')
  const corner = [...ctx.getImageData(3, 3, 1, 1).data]
  const middle = [...ctx.getImageData(256, 256, 1, 1).data]
  const near = (a, b) => a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= 6)
  check('logo: 512×512 square', ll.w === 512 && ll.h === 512, ll)
  check(
    'logo: corner = cream background (not cut, not black)',
    near(corner, [255, 253, 249]),
    corner,
  )
  check('logo: wordmark kept in the middle', near(middle, [31, 27, 22]), middle)

  // 4. too small barber photo → clear error with the real size
  const tiny = await blobOf(makeCanvas(300, 300, gradient), 'image/jpeg', 0.9)
  try {
    await m.processImage(tiny, 'staff')
    check('too small → error', false, 'no error')
  } catch (e) {
    check(
      'too small → tooSmall 300×300 (min 400)',
      e.key === 'tooSmall' && e.params.w === 300 && e.params.min === 400,
      e.params,
    )
  }

  // 5. unreadable file (e.g. HEIC on desktop Chrome) → unreadable
  const junk = new Blob([new Uint8Array(2000).map((_, i) => (i * 37) % 256)], {
    type: 'image/heic',
  })
  check(
    'unreadable file → unreadable',
    (await errKey(m.processImage(junk, 'gallery'))) === 'unreadable',
  )

  // 6. over 25 MB → tooLarge (before decoding)
  const huge = new Blob([new Uint8Array(25 * 1024 * 1024 + 1)], { type: 'image/jpeg' })
  check('over 25 MB → tooLarge', (await errKey(m.processImage(huge, 'gallery'))) === 'tooLarge')

  // 7. phone photo with EXIF "rotate 90°" (orientation 6): 600×400 stored → 400×600 shown
  const flat = new Uint8Array(
    await (await blobOf(makeCanvas(600, 400, gradient), 'image/jpeg', 0.9)).arrayBuffer(),
  )
  const exif = new Uint8Array([
    0xff,
    0xe1,
    0x00,
    0x22, // APP1, length 34
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00, // "Exif\0\0"
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08, // TIFF big-endian, IFD at 8
    0x00,
    0x01, // 1 entry
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x06,
    0x00,
    0x00, // Orientation = 6
    0x00,
    0x00,
    0x00,
    0x00, // no next IFD
  ])
  const rotated = new Blob([flat.slice(0, 2), exif, flat.slice(2)], { type: 'image/jpeg' })
  const ro = await m.processImage(rotated, 'gallery')
  const rl = await sizeOf(ro.lg)
  check(
    'EXIF rotation applied: 600×400 (orientation 6) → 400×600',
    rl.w === 400 && rl.h === 600,
    rl,
  )

  // 8. Safari-like browser (cannot make WebP: returns PNG instead) → JPEG fallback
  const original = HTMLCanvasElement.prototype.toBlob
  HTMLCanvasElement.prototype.toBlob = function (cb, type, q) {
    return original.call(this, cb, type === 'image/webp' ? 'image/png' : type, q)
  }
  try {
    const sf = await m.processImage(big, 'services')
    const sl = await sizeOf(sf.lg)
    check(
      'no-WebP browser → JPEG, same ext for both sizes',
      sf.ext === 'jpg' && sf.lg.type === 'image/jpeg' && sf.sm.type === 'image/jpeg',
      sf.lg.type,
    )
    check('service: centre square 480×480', sl.w === 480 && sl.h === 480, sl)
  } finally {
    HTMLCanvasElement.prototype.toBlob = original
  }
  return out
})

await browser.close()
await server.close()

let failed = 0
for (const r of results) {
  if (!r.ok) failed++
  console.log(
    `${r.ok ? 'ok    ' : 'NOT OK'}  ${r.name}${r.ok ? '' : `  → ${JSON.stringify(r.detail)}`}`,
  )
}
if (pageErrors.length) console.log('page errors (app page, not the check):', pageErrors.length)
console.log(`\n# ${results.length - failed}/${results.length} image checks passed`)
process.exit(failed ? 1 : 0)
