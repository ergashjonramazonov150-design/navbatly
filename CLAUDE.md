# NAVBATLY — instructions for Claude

Booking app for barbershops/salons in Uzbekistan (React + Vite + Supabase + Vercel).
The full plan and every decision live in **docs/ARCHITECTURE.md**. Read it first,
then `git log --oneline -20` and `supabase/migrations/`.

## Working rules (always follow)

1. **The user is a beginner.** Explain things simply and in plain words. Before coding
   a milestone or delivery, post a short plan and wait for approval.
2. **Migrations:** explain every migration in plain terms (what it changes and why) and
   **wait for an explicit OK before applying** it (`npm run db:push`). Never edit an
   applied migration; add a new one instead. After applying, regenerate types
   (`npm run db:types`).
3. **No new UI without an approved mockup** (`design/*.html`). New screens = mockup
   first, then approval, then code.
4. **UI text in Uzbek (Latin)**, always through i18n (`src/i18n/locales/uz/*.json`),
   never hard-coded in components.
5. **After every deploy run `npm run check:live`** and report the result.
6. **Commit and push the branch after every meaningful step**, so nothing is lost if a
   session ends unexpectedly. Work-in-progress commits are fine (`wip:` prefix).
7. **Run every SQL snippet or command yourself, exactly as written, before putting it in a
   checklist or instructions** for the user.
8. Settings changes never modify bookings automatically. Warn the owner with the number
   of affected future bookings instead (ARCHITECTURE.md, "never change bookings
   automatically").

## Commands

| What                              | Command                                           |
| --------------------------------- | ------------------------------------------------- |
| Check applied migrations (dev)    | `npx supabase migration list --remote`            |
| Apply migrations (after OK)       | `npm run db:push`                                 |
| Regenerate DB types               | `npm run db:types`                                |
| DB tests (pgTAP, all / one file)  | `npm run db:test` / `npm run db:test -- 04`       |
| Real parallel double-booking test | `npm run db:test:race`                            |
| Dry-run an UNAPPLIED migration    | `npm run db:test -- --with-migration <file.sql>`  |
| Frontend tests / types / lint     | `npm test` · `npm run typecheck` · `npm run lint` |
| Live site check (after deploy)    | `npm run check:live`                              |
| Security + performance advisors   | Supabase MCP `get_advisors` (both types)          |
| Photo processing in real Chrome   | `npm run check:images`                            |
| Orphan photo files (dry run)      | `npm run storage:orphans` (`-- --delete` deletes) |
| Demo photos for checklists        | `npm run demo:photos` (→ `demo-photos/`, ignored) |

There's no Docker. Everything runs against the cloud **navbatly-dev** project
(`qxzcsuodzpmkksgjosvn`). The CLI labels it "production", but it's the dev project.
Known advisor warning: `auth_leaked_password_protection` (not available on the free
plan).

**Windows quirk (lowercase `c:\…` terminals, e.g. VS Code):** paths then resolve as both
`c:` and `C:`.

- **Vitest** fails every file with "Vitest failed to find the current suite" → run tests
  from `C:\Users\user\Documents\Navbatly` (uppercase `C:`).
- **Dev server** used to pre-bundle React twice ("Invalid hook call" / "reading
  'useEffect'") → fixed in `vite.config.ts` (root + `@` alias use an uppercase drive).
- Never leave a shell `cd`-ed inside `node_modules/.vite` — it locks the cache (EBUSY).
- Plain-http dev on the LAN (phone tests) is not a "secure context": no
  `crypto.randomUUID`, no clipboard API. Use `crypto.getRandomValues` (see
  `src/lib/images/paths.ts`).

## Status (update at the end of every session)

_Last updated: 2026-11-14_

- ✅ **Done and approved:** M0, M1 (migrations 1–6, pgTAP suite), design mockups
  (`design/01–03`), M2 (login, roles, shell), **M3 complete** — 3a (migration 7 +
  Xizmatlar), 3b (migration 8 + Ustalar, Ish vaqti, Dam olish), 3c (Sozlamalar, no
  migration, DB test 05); all merged to `main` and deployed 2026-11-13.
- 🔄 **In progress: M3.5** visual upgrade. Step 1 mockups (`design/02` v3, `design/04`)
  approved and merged to `main`. Step 2 plan approved (public bucket, owner crops barber
  photos AND cover, gallery in upload order, `react-easy-crop@6.2.4`). **2a done:**
  migration 9 (`20261113121720_salon_images.sql`) **applied to dev** 2026-11-13, tests
  193/193, race ok, advisors unchanged, types regenerated (branch `m35-storage`).
  **2b approved** (`design/05-admin-photos.html`; logo fitted whole, not cropped).
  **2c built** on `m35-storage` (2026-11-14): `src/lib/images/*`, `src/features/images/*`,
  photo spots in Sozlamalar / Usta profili / Xizmat dialog / deactivate dialog; tests 125,
  `check:images` 15/15. **Waiting for the user's manual checklist** (incl. real iPhone
  via `npm run dev -- --host`, Windows Firewall → Private only). Deploy only after it
  passes.
- ⏭ **Next:** merge `m35-storage` → `main`, deploy, `check:live`; then **M4** (public
  booking — shows the photos).
- ℹ️ The Vercel MCP connection needs team access re-authorized before it can read deploys.
  Until then, confirm a deploy by finding new UI text in the live `assets/start-*.js`
  file, then run `npm run check:live`.
- 📌 **Pending before M5:** make the seed's demo bookings relative to "today"
  (re-runnable `npm run db:seed`).
