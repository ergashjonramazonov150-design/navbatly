#!/usr/bin/env node
/**
 * Finds (and optionally deletes) ORPHAN salon images: files in the `salon-images` bucket
 * that no database row points to any more (left over when a step failed — see
 * docs/ARCHITECTURE.md "Salon images: upload order and orphan clean-up").
 *
 *   npm run storage:orphans              → only SHOWS the list (safe, default)
 *   npm run storage:orphans -- --delete  → deletes those files
 *
 * Needs SUPABASE_SECRET_KEY in .env.local (Supabase → Project Settings → API Keys →
 * Secret keys). NEVER a VITE_ variable: VITE_ values end up in the browser.
 * Safety: dev project only; refuses if a secret key is found in any VITE_ variable;
 * never prints the key. Files younger than 1 day are never touched (uploads in progress).
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'

const DEV_PROJECT_REF = 'qxzcsuodzpmkksgjosvn' // navbatly-dev
const BUCKET = 'salon-images'
const doDelete = process.argv.includes('--delete')
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

// --- read .env.local without printing anything from it ---
if (!existsSync('.env.local')) fail('.env.local not found (run from the project folder).')
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ''),
      ]
    }),
)

const looksSecret = (v) => /^sb_secret_/.test(v) || /service_role/.test(atobSafe(v))
function atobSafe(v) {
  try {
    const part = v.split('.')[1]
    return part ? Buffer.from(part, 'base64url').toString('utf8') : ''
  } catch {
    return ''
  }
}
const leaked = Object.entries(env).filter(([k, v]) => k.startsWith('VITE_') && looksSecret(v))
if (leaked.length) {
  fail(
    `A SECRET key is in ${leaked.map(([k]) => k).join(', ')} — VITE_ values are sent to the browser!\n` +
      '  Remove it from that variable, then rotate the key in Supabase (API Keys).',
  )
}

const url = env.VITE_SUPABASE_URL
const key = env.SUPABASE_SECRET_KEY
if (!url) fail('VITE_SUPABASE_URL is missing in .env.local.')
if (!url.includes(DEV_PROJECT_REF))
  fail(`Refusing: .env.local points to another project, expected dev "${DEV_PROJECT_REF}".`)
if (!key) {
  fail(
    'SUPABASE_SECRET_KEY is missing in .env.local.\n' +
      '  Supabase dashboard → navbatly-dev → Project Settings → API Keys → Secret keys →\n' +
      '  "+ New secret key" (name: orphan-cleanup) → copy → add one line to .env.local:\n' +
      '  SUPABASE_SECRET_KEY=sb_secret_...',
  )
}
if (!/^sb_secret_/.test(key))
  fail(
    'SUPABASE_SECRET_KEY should start with "sb_secret_" (the new Secret key, not the publishable key).',
  )

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data, error } = await supabase.rpc('list_orphan_salon_images', { p_older_than: '1 day' })
if (error) fail(`Could not list orphans: ${error.message}`)

console.log(`# ${data.length} orphan file(s) older than 1 day in "${BUCKET}"`)
for (const f of data) console.log(`  ${f.created_at.slice(0, 16).replace('T', ' ')}  ${f.name}`)

if (!data.length) process.exit(0)
if (!doDelete) {
  console.log('\nNothing deleted (dry run). To delete them: npm run storage:orphans -- --delete')
  process.exit(0)
}

let deleted = 0
const names = data.map((f) => f.name)
for (let i = 0; i < names.length; i += 100) {
  const chunk = names.slice(i, i + 100)
  const { data: removed, error: rmError } = await supabase.storage.from(BUCKET).remove(chunk)
  if (rmError) fail(`Delete failed after ${deleted} file(s): ${rmError.message}`)
  deleted += removed.length
}
console.log(`\n✓ deleted ${deleted} file(s)`)
