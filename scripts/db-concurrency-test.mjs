#!/usr/bin/env node
/**
 * REAL race-condition test for double booking (dev project only).
 *
 * Two create_booking calls for the SAME staff + slot run over TWO separate
 * database connections at the same time:
 *   A: books the slot and keeps its transaction open for 3 s (pg_sleep)
 *   B: starts 1 s later. B can't see A's uncommitted booking, so every check
 *      in create_booking passes — only the EXCLUDE constraint can stop it.
 *      B must wait for A, then fail with SLOT_TAKEN.
 *
 * It creates a temporary salon "zz-concurrency-test" and ALWAYS deletes it.
 * Usage: npm run db:test:race
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DEV_PROJECT_REF = 'qxzcsuodzpmkksgjosvn'
const linkedRef = readFileSync('supabase/.temp/project-ref', 'utf8').trim()
if (linkedRef !== DEV_PROJECT_REF) {
  console.error(
    `Refusing to run: linked project is "${linkedRef}", expected dev "${DEV_PROJECT_REF}".`,
  )
  process.exit(1)
}

const BIZ = 'cccccccc-0000-0000-0000-00000000000a'
const STAFF = 'cccccccc-0000-0000-0000-0000000000a1'
const SERVICE = 'cccccccc-0000-0000-0000-0000000000b1'
const SLOT = `(((now() at time zone 'Asia/Tashkent')::date + 2 + time '10:00') at time zone 'Asia/Tashkent')`

const SETUP = `
insert into public.businesses (id, name, slug) values ('${BIZ}', 'ZZ Concurrency Test', 'zz-concurrency-test');
insert into public.staff (id, business_id, full_name) values ('${STAFF}', '${BIZ}', 'Race Barber');
insert into public.services (id, business_id, name, duration_minutes, price_uzs)
  values ('${SERVICE}', '${BIZ}', 'Race Cut', 30, 1000);
insert into public.staff_services (business_id, staff_id, service_id) values ('${BIZ}', '${STAFF}', '${SERVICE}');
insert into public.working_hours (business_id, staff_id, weekday, start_time, end_time)
  select '${BIZ}', '${STAFF}', d, '09:00', '19:00' from generate_series(1, 7) d;
select 'setup ok' as status;`

const booking = (phone, ip) =>
  `public.create_booking('${BIZ}', '${SERVICE}', '${STAFF}', ${SLOT}, 'Racer', '${phone}', null, '${ip}')`

// A: insert first, then hold the transaction open for 3 seconds
const SESSION_A = `with b as materialized (select ${booking('+998900000101', 'iphash-race-session-a')} as r)
select b.r::text as result, pg_sleep(3)::text as slept from b;`
// B: plain call
const SESSION_B = `select ${booking('+998900000102', 'iphash-race-session-b')}::text as result;`

const VERIFY = `select count(*) as active_bookings from public.appointments
where staff_id = '${STAFF}' and status in ('pending', 'confirmed');`
const CLEANUP = `delete from public.businesses where id = '${BIZ}';
select (select count(*) from public.businesses where id = '${BIZ}') as leftover;`

const tmp = mkdtempSync(join(tmpdir(), 'navbatly-race-'))
let fileNo = 0

// SQL goes through a temp file: multi-line arguments break on Windows shells
function query(sql) {
  const file = join(tmp, `q${++fileNo}.sql`)
  writeFileSync(file, sql)
  const command = `npx supabase db query --remote --yes --output-format json -f "${file}"`
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(command, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', () => resolve({ out, ms: Date.now() - started }))
  })
}

const pick = (out, key) => {
  const m = new RegExp(`"${key}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|\\d+)`).exec(out)
  return m ? JSON.parse(m[1]) : null
}

let failed = false
const check = (cond, msg) => {
  console.log(`${cond ? 'ok' : 'not ok'} - ${msg}`)
  if (!cond) failed = true
}

try {
  const setup = await query(SETUP)
  if (pick(setup.out, 'status') !== 'setup ok') throw new Error(`setup failed:\n${setup.out}`)

  // Fire both sessions; B starts 1 s after A (while A's booking is uncommitted)
  const pA = query(SESSION_A)
  await new Promise((r) => setTimeout(r, 1000))
  const pB = query(SESSION_B)
  const [a, b] = await Promise.all([pA, pB])

  const resA = JSON.parse(pick(a.out, 'result') ?? '{}')
  const resB = JSON.parse(pick(b.out, 'result') ?? '{}')
  console.log(`# session A (${a.ms} ms):`, JSON.stringify(resA))
  console.log(`# session B (${b.ms} ms):`, JSON.stringify(resB))

  check(resA.ok === true, 'session A booked the slot')
  check(resB.ok === false && resB.code === 'SLOT_TAKEN', 'session B got SLOT_TAKEN')

  const verify = await query(VERIFY)
  check(
    Number(pick(verify.out, 'active_bookings')) === 1,
    'exactly ONE active booking exists for that slot',
  )
} catch (err) {
  console.error(err.message)
  failed = true
} finally {
  const cleanup = await query(CLEANUP)
  check(Number(pick(cleanup.out, 'leftover')) === 0, 'cleanup: temporary test salon deleted')
  rmSync(tmp, { recursive: true, force: true })
}

process.exit(failed ? 1 : 0)
