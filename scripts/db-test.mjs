#!/usr/bin/env node
/**
 * Runs the pgTAP tests in supabase/tests/*.sql against the linked DEV project,
 * without Docker.
 *
 * How it stays safe:
 *   - It refuses to run unless the linked project is the dev project.
 *   - Each test file's final `rollback;` is replaced by a statement that RAISES
 *     AN ERROR containing the test report. An error always aborts the whole
 *     transaction, so nothing a test creates can ever be saved — regardless of
 *     how the CLI/API wraps the query.
 *
 * Usage: npm run db:test            (all files)
 *        npm run db:test -- 01      (files whose name contains "01")
 *
 * Dry run of a migration that is NOT applied yet:
 *        npm run db:test -- --with-migration supabase/migrations/<file>.sql [filter]
 *   The migration SQL is placed right after each test file's `begin;`, inside the same
 *   transaction that always rolls back — so the migration + all tests run, nothing stays.
 *   The migration file must not contain its own begin/commit.
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DEV_PROJECT_REF = 'qxzcsuodzpmkksgjosvn' // navbatly-dev — tests must never run anywhere else
const TESTS_DIR = 'supabase/tests'
const REPORT_MARKER = '@@TAP@@'

const REPORT_SQL = `
set local role postgres;
do $report$
begin
  -- marker is built from two halves so it never appears literally in the SQL text
  -- (Postgres echoes the SQL in error context; only the real report must match)
  raise exception using message = '@@TA' || 'P@@' || E'\\n' || (
    -- compact: the API truncates long error messages (~1000 chars), so we send totals
    -- + for each FAILING test only its first line and the have/want (or caught/wanted)
    select 'TOTAL ' || count(*) || ' FAILED ' || count(*) filter (where t.line like 'not ok%')
      || coalesce(E'\\n' || string_agg(
           split_part(t.line, E'\\n', 1)
           || coalesce(' ⟶ ' || nullif(regexp_replace(
                (select string_agg(btrim(x), ' ') from regexp_split_to_table(t.line, E'\\n') x
                 where x ~ '^#\\s+(have|want|caught|wanted):'),
                '#\\s+', '', 'g'), ''), ''),
           E'\\n' order by t.at) filter (where t.line like 'not ok%'), '')
    from tests.tap t
  ) || E'\\n' || '@@TA' || 'P@@';
end
$report$;
`

const linkedRef = readFileSync('supabase/.temp/project-ref', 'utf8').trim()
if (linkedRef !== DEV_PROJECT_REF) {
  console.error(
    `Refusing to run: linked project is "${linkedRef}", expected dev "${DEV_PROJECT_REF}".`,
  )
  process.exit(1)
}

const args = process.argv.slice(2)
const migIdx = args.indexOf('--with-migration')
const migrationPath = migIdx === -1 ? null : args[migIdx + 1]
if (migIdx !== -1 && !migrationPath) {
  console.error('--with-migration needs a file path.')
  process.exit(1)
}
const migrationSql = migrationPath ? readFileSync(migrationPath, 'utf8') : ''
if (/^\s*(begin|commit|rollback)\s*;/im.test(migrationSql)) {
  console.error(
    `${migrationPath}: contains begin/commit/rollback — refusing (it would end the safe transaction).`,
  )
  process.exit(1)
}
if (migrationPath) console.log(`# DRY RUN with unapplied migration ${migrationPath} (rolled back)`)
const filter = args.filter((a, i) => i !== migIdx && i !== migIdx + 1)[0] ?? ''
const files = readdirSync(TESTS_DIR)
  .filter((f) => f.endsWith('_test.sql') && f.includes(filter))
  .sort()

if (files.length === 0) {
  console.error('No test files found.')
  process.exit(1)
}

const tmp = mkdtempSync(join(tmpdir(), 'navbatly-dbtest-'))
let totalPass = 0
let totalFail = 0
let crashed = 0

for (const file of files) {
  const source = readFileSync(join(TESTS_DIR, file), 'utf8')
  const lastRollback = source.lastIndexOf('rollback;')
  if (lastRollback === -1) {
    console.error(`${file}: must end with "rollback;" — skipped for safety.`)
    crashed++
    continue
  }
  let body = source.slice(0, lastRollback)
  if (migrationSql) {
    const begin = body.search(/^begin;\s*$/m)
    if (begin === -1) {
      console.error(`${file}: no "begin;" line to put the migration after — skipped.`)
      crashed++
      continue
    }
    const at = begin + 'begin;'.length
    body = `${body.slice(0, at)}\n-- ===== DRY-RUN MIGRATION =====\n${migrationSql}\n-- ===== END MIGRATION =====\n${body.slice(at)}`
  }
  const sql = body + REPORT_SQL
  const tmpFile = join(tmp, file)
  writeFileSync(tmpFile, sql)

  let output = ''
  try {
    output = execSync(`npx supabase db query --remote --yes --output-format json -f "${tmpFile}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    output = `${err.stdout ?? ''}${err.stderr ?? ''}`
  }

  // The report travels inside the (JSON-escaped) error message.
  const decoded = output.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\"/g, '"')
  const start = decoded.indexOf(REPORT_MARKER)
  let end = decoded.indexOf(REPORT_MARKER, start + 1)
  // Many failures can still exceed the API's message limit: use what arrived, and say so.
  const truncated = start !== -1 && end === -1 && /TOTAL \d+ FAILED \d+/.test(decoded)
  if (truncated) end = decoded.length

  console.log(`\n# ${file}`)
  if (start === -1 || end === -1) {
    console.log('not ok - test file crashed before finishing:')
    console.log(decoded.trim().slice(-2000))
    crashed++
    continue
  }

  const lines = decoded
    .slice(start + REPORT_MARKER.length, end)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const summary = /^TOTAL (\d+) FAILED (\d+)$/.exec(lines[0] ?? '')
  if (!summary) {
    console.log('not ok - could not read the test report:')
    console.log(lines.join('\n'))
    crashed++
    continue
  }
  const total = Number(summary[1])
  const failed = Number(summary[2])
  totalPass += total - failed
  totalFail += failed
  console.log(`${total - failed}/${total} passed`)
  // failing tests + pgTAP diagnostics ("#   have: ...  want: ...")
  for (const line of lines.slice(1))
    if (!line.startsWith('"}') && line !== 'Target:') console.log(line)
  if (truncated) console.log('# (report truncated by the API — totals above are exact)')
  if (total === 0) {
    console.log('not ok - no assertions ran')
    crashed++
  }
}

rmSync(tmp, { recursive: true, force: true })

console.log(`\n# passed: ${totalPass}, failed: ${totalFail}, crashed files: ${crashed}`)
process.exit(totalFail > 0 || crashed > 0 ? 1 : 0)
