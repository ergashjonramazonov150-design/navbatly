#!/usr/bin/env node
/**
 * Downloads the demo photos (Pexels, free licence — see docs/IMAGE_CREDITS.md) into the
 * git-ignored folder demo-photos/, for uploading through the admin screens during the
 * M3.5 checklist. Photos are downloaded big (like phone photos) to test compression.
 * Also creates one deliberately TOO SMALL photo to test the error message.
 *
 * Usage: npm run demo:photos
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'demo-photos'
const px = (id, w) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`

const PHOTOS = [
  ['01-cover', 13138476, 'Marvin Sacdalan'],
  ['02-barber-jasur', 8867537, 'Los Muertos Crew'],
  ['03-barber-bobur', 20302331, 'Ben Khatry'],
  ['04-service-soch-olish', 7447133, 'Gustavo Fring'],
  ['05-service-soqol-olish', 3998427, 'cottonbro studio'],
  ['06-service-bolalar', 19664861, 'Kawê Rodrigues'],
  ['07-gallery-1', 12464841, 'izzet çakallı'],
  ['08-gallery-2', 9992817, 'Alex Urezkov'],
  ['09-gallery-3', 3998431, 'cottonbro studio'],
  ['10-gallery-4', 1453005, 'Luis Quintero'],
  ['11-gallery-5', 7447120, 'Gustavo Fring'],
  ['12-gallery-6', 19664876, 'Kawê Rodrigues'],
  ['13-gallery-7', 37764947, 'wal_ 172619'],
  ['14-gallery-8', 1895701, 'Lisa Fotios'],
  ['15-gallery-9', 6843637, 'Italo Crespi'],
]

mkdirSync(DIR, { recursive: true })
let ok = 0
for (const [name, id, author] of PHOTOS) {
  const res = await fetch(px(id, 2400))
  if (!res.ok) {
    console.log(`✗ ${name} (${id}): HTTP ${res.status}`)
    continue
  }
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(join(DIR, `${name}.jpg`), buf)
  console.log(
    `✓ ${name}.jpg  ${(buf.length / 1024 / 1024).toFixed(1)} MB  — ${author} (Pexels ${id})`,
  )
  ok++
}
// too small on purpose: 300 px wide → "Rasm juda kichik (300 × … px)"
const small = await fetch(px(7447133, 300))
if (small.ok) {
  writeFileSync(join(DIR, '99-test-too-small-300px.jpg'), Buffer.from(await small.arrayBuffer()))
  console.log('✓ 99-test-too-small-300px.jpg  (for the "too small" error)')
}
console.log(
  `\n# ${ok}/${PHOTOS.length} photos in ${DIR}/ (git-ignored). Credits: docs/IMAGE_CREDITS.md`,
)
