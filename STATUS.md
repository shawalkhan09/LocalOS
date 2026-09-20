# LocalOS — Project Status

This file is the single source of truth for what has shipped, what's in
review, what's known-broken, and what's next. Update it after every
session or group of chunks — do not let it drift from reality.

## What this is
LocalOS is a config-driven booking/CRM/dashboard platform for local service
businesses. Built as a portfolio piece and a live sales demo for freelance
client outreach. The live demo is "Ironclad Fitness" (a gym), configured
via `clients/gym-demo/config.json`.

**Architecture decision (final, do not revisit):** single-tenant per
deployment, not multi-tenant SaaS. One core engine, config-driven per
business, deployed separately per client with its own database. This was
a deliberate, considered choice — never propose multi-tenancy.

## Stack
- npm-workspaces monorepo: `apps/api` (Express), `apps/web` (Next.js),
  `packages/config-schema` (zod), `packages/db` (Drizzle ORM + Postgres)
- Deployed on Vercel (web) + Render (API, free tier) + Neon (Postgres,
  free tier)
- Auth: opaque session tokens in an httpOnly cookie, bcrypt password
  hashing, two roles only (`owner`, `staff`)
- All date/time logic goes through Luxon and the business's configured
  timezone — never naive `new Date()` arithmetic or the server's own
  timezone. A real cross-timezone bug shipped once already (see Chunk 2)
  because of this.
- No lint script or ESLint config exists anywhere in the repo. Build and
  `tsc --noEmit` (typecheck) are the only automated checks available.

## Working conventions
- Branch naming: `chunk-N-<short-topic>`, created fresh off `main` each
  time, never reused from a prior merged chunk. PR title: "Chunk N: <topic>".
- Commit messages: one-liner, no AI/model attribution.
- Render's API service never auto-deploys despite "Auto-Deploy: On
  Commit" — every deploy requires a manual "Deploy latest commit" click.
  Render only hosts `apps/api`, so a chunk that only touches `apps/web`
  needs no Render step at all.
- Any schema/migration change requires the careful sequence: migrate Neon
  first (additive only, nullable columns / partial indexes), THEN deploy
  the API code. Never the other way around. Plain code-only chunks (no
  schema change) just need merge + Render manual deploy (only if
  `apps/api` changed) + Vercel auto-build.

## Chunks shipped
1. **Customer archive/unarchive** (soft delete via `archivedAt` column).
   Available to both owner and staff.
2. **Booking time validation**: rejects past times, enforces business
   hours, advance-booking window, duration match, same-customer double-
   booking, class-weekday validation, duplicate class-seat rejection.
   Shipped with a real cross-server-timezone bug (valid evening bookings
   rejected when server timezone ≠ business timezone), found and fixed
   before merge. Manually re-confirmed live 2026-09-20.
3. **Password management**: self-service `POST /auth/change-password`
   (keeps current session alive, signs out all others) and owner-only
   `POST /users/:id/reset-password` (no current-password proof needed,
   blocks self-targeting, forces full logout of the target account). Web
   UI: `/dashboard/account` page + Team page reset action.
4. **Staff account linking constraint**: a staff member can now be linked
   to at most one login account (DB-level partial unique index on
   `users.staffId`), with a friendly 409 instead of a raw DB error. A
   deploy-breaking bug was fixed during review: the migration SQL was
   correct but `migrations/meta/_journal.json` was never updated, so
   `drizzle-kit migrate` would have silently applied nothing.
5. **Staff schedule view**: logged-in staff members can view their own
   upcoming sessions and classes for the next 14 days on `/dashboard/schedule`.
   API endpoint `GET /staff/me/schedule` returns bookings assigned to the
   staff member's staffId plus class occurrences where the class trainerId
   maps to a trainer with that staffId. Classes *are* included: built from
   config.json class definitions + trainer_profiles DB link, not a separate
   DB table. If account is not linked to a staff member, returns `linked: false`
   with empty items. Navigation: "My schedule" link visible only to staff role.
   A blocking bug was found and fixed during review: `usersRouter.use(requireOwner)`
   and `staffRouter.use(requireOwner)` were unscoped blanket router middleware,
   which in Express applies to every request reaching that router, not just
   routes defined on it — since `usersRouter` was mounted right before
   `staffRouter`, every staff-role request to any `staffRouter` route (including
   the new schedule endpoint) was rejected with 403 before reaching its handler.
   This predated this chunk but was invisible until now because every existing
   staffRouter route was already owner-only. Fixed by replacing both blanket
   `.use(requireOwner)` calls with `requireOwner` as an explicit per-route
   middleware on each of the eight owner-only routes across both files.

## In review / not yet merged
- **Chunk 4b: Mobile account menu** (PR #5): adds a compact "Account"
  button in the mobile nav (below 640px) with a toggle menu for "Change
  password" and "Log out," reusing the existing handler and route
  unchanged. Web-only, no schema change. One minor known gap: no
  click-outside-to-close handler on the new menu.

## Known, confirmed, not-yet-fixed bugs
- On `/dashboard/account`, editing the confirm-password field to match
  after a "Passwords do not match" error does not clear the error until
  the form is resubmitted (stale error, cosmetic).
- The too-short-password validation error may surface a raw validation
  code (`too_small`) rather than a friendly message.
- The public class-booking page defaults to today's date even when the
  selected class doesn't run today, only erroring at final confirmation.
- Leftover test/demo data in production (a stray "Test Booking" customer,
  an extra Dana Reliable booking, a class seat, plus QA-created records
  from 2026-09-20 testing) — no cleanup done, no cancel-booking feature
  exists to do it cleanly through the UI.

## Open/unanswered
- Whether the owner password was ever typed into a tool during a manual
  QA pass.
- Two API keys (a Neon key + one unnamed service) were pasted in
  plaintext into a coding agent chat during original deployment — need
  to be revoked, and the second service identified.

## Backlog / not started
- Fold in the two small `/dashboard/account` UI bugs above whenever that
  page is next touched.
- Click-outside-to-close on the chunk 4b mobile menu.
- The "garage" vertical (a second demo business type) is explicitly
  paused — do not start it without being asked.
