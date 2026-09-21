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
   A second bug was found and fixed after initial deploy: the schedule page displayed all times in the viewer's browser timezone instead of the business's configured timezone (e.g. a 6:00 AM class showed as 5:00 PM for a viewer in a different timezone), and grouped items by UTC calendar day instead of the business's calendar day. Fixed in PR #8 by reusing the existing formatTimeInTimezone/formatDateInTimezone helpers in apps/web/src/lib/time.ts (already used correctly elsewhere, e.g. new-booking/page.tsx) instead of raw, timezone-naive Date formatting.
6. **Small UI bug fixes** (PR #10, fix-small-ui-bugs, merged to main at commit 8bad23e): Stale password-mismatch error on /dashboard/account now clears on input change, not just on resubmit. Password validation errors return a clean message instead of a raw Zod JSON blob (password-related throw sites only: POST /auth/change-password, POST /users, POST /users/:id/reset-password). Mobile account menu click-outside-to-close now works. Mobile account menu is now visible at every viewport width (fixed a CSS specificity tie between two .mobileAccountContainer rules with identical specificity, one unconditional display: none and one in @media (max-width: 639px) with display: flex — the later rule was always winning due to source-order specificity tie-breaking; moved the unconditional rule before the media query so the media query override wins at narrow widths).
7. **Chunk 4b: Mobile account menu** (PR #5, merged to main): adds a compact "Account" button in the mobile nav (below 640px) with a toggle menu for "Change password" and "Log out," reusing the existing handler and route unchanged. Web-only, no schema change. Its missing click-outside-to-close and a CSS bug that hid the menu at every viewport width were both fixed later in PR #10 (entry 6).
8. **Class booking default date fix** (PR #15, fix-class-booking-default-date, merged to main): the public class-booking page now defaults to the next date the selected class actually runs, counted from today in the business's timezone and inside the advance-booking window. A day only counts if the class runs on that weekday and, for today, the class start time is still in the future (matching the API's "already started" rule). Picking a date the class does not run, or today after the class has started, shows an inline message and disables Continue; a class with no bookable date in the window shows a friendly message instead of the form. Web-only: added nowTimeInTimezone and getNextClassOccurrenceDate to apps/web/src/lib/time.ts. Verified live on 2026-09-21.

## In review / not yet merged
None currently.

## Known, confirmed, not-yet-fixed bugs
- Leftover test/demo data in production (a stray "Test Booking" customer,
  an extra Dana Reliable booking, a class seat, plus QA-created records
  from 2026-09-20 testing) — no cleanup done, no cancel-booking feature
  exists to do it cleanly through the UI.

## Open/unanswered
None currently.

## Backlog / not started
- The "garage" vertical (a second demo business type) is explicitly
  paused — do not start it without being asked.
- API startup: the `listen` callback in `apps/api/src/index.ts` ignores the
  error argument, so a port conflict still logs "api listening". Make it fail
  loudly (needs a Render deploy when done).
- Timezone helpers: `localWeekday` and `formatDateInTimezone` in
  `apps/web/src/lib/time.ts` format noon UTC in the business timezone, which
  lands on the wrong calendar day at UTC+12 or later (New Zealand, Fiji,
  Tonga). Check the API's `localWeekday` too. Fine for the Denver demo, fix
  before onboarding a client in those timezones.
- Multi-slot classes: `assertBookableClassOccurrence` in
  `apps/api/src/bookingWindow.ts` checks only the first schedule slot for a
  weekday, while the class-booking page checks every slot, so a class
  scheduled twice on one weekday can pass the page and fail at confirmation.
  The demo config has one slot per day.
