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
| Frontend tests / types / lint     | `npm test` · `npm run typecheck` · `npm run lint` |
| Live site check (after deploy)    | `npm run check:live`                              |
| Security + performance advisors   | Supabase MCP `get_advisors` (both types)          |

There's no Docker. Everything runs against the cloud **navbatly-dev** project
(`qxzcsuodzpmkksgjosvn`). The CLI labels it "production", but it's the dev project.
Known advisor warning: `auth_leaked_password_protection` (not available on the free
plan).

**Windows quirk:** if `npm test` fails every file with "Vitest failed to find the
current suite", the shell was started in `c:\…` (lowercase drive). Vitest then loads
itself twice. Run it from `C:\Users\user\Documents\Navbatly` (uppercase `C:`) instead.

## Status (update at the end of every session)

_Last updated: 2026-11-13_

- ✅ **Done and approved:** M0, M1 (migrations 1–6, pgTAP suite), design mockups
  (`design/01–03`), M2 (login, roles, shell), M3 **3a** (migration 7 + Xizmatlar),
  M3 **3b** (migration 8 + Ustalar, Ish vaqti, Dam olish; manual checklist passed,
  merged to `main` and deployed 2026-11-13).
- 🔄 **In progress: M3 3c** (Sozlamalar): plan posted, waiting for the user's OK.
- ⏭ **Next:** **M3.5** visual upgrade (mockups first: image-rich booking page + `design/04-landing.html`; then Supabase Storage uploads), then **M4**
  (public booking).
- 📌 **Pending before M5:** make the seed's demo bookings relative to "today"
  (re-runnable `npm run db:seed`).
