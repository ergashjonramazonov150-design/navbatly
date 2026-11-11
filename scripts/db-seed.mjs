#!/usr/bin/env node
/**
 * Loads supabase/seed.sql into the linked DEV project.
 *
 * Login emails are read from .env.local (git-ignored):
 *   SEED_OWNER_EMAIL=...
 *   SEED_BARBER_EMAIL=...
 * and substituted into the seed at run time, so they never end up in git.
 *
 * Usage: npm run db:seed
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DEV_PROJECT_REF = 'qxzcsuodzpmkksgjosvn'
const linkedRef = readFileSync('supabase/.temp/project-ref', 'utf8').trim()
if (linkedRef !== DEV_PROJECT_REF) {
  console.error(
    `Refusing to seed: linked project is "${linkedRef}", expected dev "${DEV_PROJECT_REF}".`,
  )
  process.exit(1)
}

// Read KEY=value pairs from .env.local (no extra dependency needed)
const env = { ...process.env }
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const EMAIL = /^[^\s@'"\\]+@[^\s@'"\\]+\.[^\s@'"\\]+$/ // also blocks quotes → no SQL injection
const owner = env.SEED_OWNER_EMAIL ?? ''
const barber = env.SEED_BARBER_EMAIL ?? ''
if (!EMAIL.test(owner) || !EMAIL.test(barber)) {
  console.error('Set SEED_OWNER_EMAIL and SEED_BARBER_EMAIL in .env.local (valid emails).')
  process.exit(1)
}

const sql = readFileSync('supabase/seed.sql', 'utf8')
  .replaceAll('__OWNER_EMAIL__', owner)
  .replaceAll('__BARBER_EMAIL__', barber)

const tmp = mkdtempSync(join(tmpdir(), 'navbatly-seed-'))
const file = join(tmp, 'seed.sql')
writeFileSync(file, sql)

let output = ''
try {
  // one quoted command string: avoids Node's "args with shell: true" warning on Windows
  output = execSync(`npx supabase db query --remote --yes --output-format json -f "${file}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (err) {
  output = `${err.stdout ?? ''}${err.stderr ?? ''}`
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (output.includes('"_tag":"Error"') || output.includes('SEED STOPPED')) {
  const stop = /SEED STOPPED:[^"\\]*/.exec(output)
  console.error(stop ? stop[0] : output.trim().slice(-1500))
  console.error('Nothing was saved (the seed runs as one transaction).')
  process.exit(1)
}

const counts = {}
for (const key of [
  'staff',
  'services',
  'staff_services',
  'working_hours',
  'members',
  'appointments',
]) {
  const m = new RegExp(`"${key}"\\s*:\\s*(\\d+)`).exec(output)
  counts[key] = m ? Number(m[1]) : '?'
}
console.log('Seeded "Navbatly Demo Barbershop" (/b/demo):', counts)
