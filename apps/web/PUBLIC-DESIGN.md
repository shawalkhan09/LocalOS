# Public marketing site — "Disciplined Kinetic" design system

Public-pages-only (`apps/web/src/app/(public)/`). The dashboard and login
keep their own chunk-8 rounded look (`apps/web/DESIGN.md`) — nothing here
touches `apps/web/src/components/` or `apps/web/src/app/dashboard/`.

## Tokens (`(public)/public-theme.css`, scoped to `.publicTheme`)

| Token | Value | Role |
|---|---|---|
| `--pub-bg` | `#08090D` | Page background |
| `--pub-bg-gradient-top` | `#0B0D14` | Top-of-page gradient stop |
| `--pub-surface` | `#12141C` | Panels |
| `--pub-accent-red` | `#E63946` | Primary CTAs, live indicator dot |
| `--pub-accent-red-text` | `#F5F1EC` | Text on a red fill |
| `--pub-accent-gold` | `#C9A24B` | Secondary CTAs, prices, checkmarks, highlighted hairlines |
| `--pub-text` | `#EDEEF2` | Primary text |
| `--pub-text-muted` | `#8A8F9C` | Secondary text |
| `--pub-hairline` | `rgba(255,255,255,0.10)` | Panel borders |
| `--pub-hairline-gold` | `rgba(201,162,75,0.35)` | Highlighted panel border (e.g. Annual plan) |

Fonts reuse the existing `next/font/google` loads from the root layout
(`--font-plus-jakarta-sans`, `--font-jetbrains-mono`) — no new font
requests. Headlines/prices/times/stats use JetBrains Mono 700–800 at
`-0.02em` to `-0.03em` tracking, fluid via `clamp()`. Body copy, nav, and
labels use Plus Jakarta Sans.

Shape: `border-radius: 0` everywhere on public pages, no `box-shadow`.
Grouping is a `--pub-surface` panel with a 1px `--pub-hairline` border; a
highlighted panel swaps to `--pub-hairline-gold` instead of a glow. Section
labels are a numeric index in JetBrains Mono (`.pubIndexLabel`, e.g.
"01 / CLASSES") with a small red dot, used where a section benefits from
one — not forced everywhere.

## Components (`(public)/_components/`)

- **PublicButton** — `variant`: `primary` (solid red fill, `--pub-accent-red-text` label) | `secondary` (transparent, gold border/text) | `ghost` (transparent, hairline border, white text). Renders a real `<a>` (via `next/link`) when given `href`, otherwise a real `<button>`. Hover is a brightness shift only.
- **PublicPanel** — hairline-bordered `--pub-surface` box; `goldAccent` prop swaps the border to `--pub-hairline-gold`.
- **Divider** — 1px hairline, `direction="horizontal" | "vertical"`.
- **CountUpStat** (Home only) — `IntersectionObserver`-based count-up, fires once per mount, used for the three real stat numbers on Home.

## Pages

Home, Classes, Trainers, Membership, Contact, and Book (session/class) all
read live from `GET /catalog` (`getCatalog()`); nothing is hardcoded from
the Ironclad reference design. Membership renders `config.membershipPlans`
generically — a two-column layout for exactly two plans, a stacked list
otherwise — and computes any "save $X/year" badge from real
`monthly.price * 12` vs `annual.price`, not a hardcoded figure. Trainers
cross-references `config.staff` via `trainerId → staffId` for name/role,
falling back to the trainer's own `bio` over the staff member's. Classes
renders each class's full `schedule` array (not a single time) and the
same trainer cross-reference. Contact's form has no backing API in this
app, so it opens the visitor's own mail client via a `mailto:` link
instead of submitting silently.

## Book pages

`book/session` and `book/class` are a restyle only — same state, effects,
and API calls as before this chunk. `Button`/`Input` (dashboard
components) were swapped for `PublicButton` and plain hairline-styled
`<input>`/`<select>` elements local to each page's own CSS module, since
those are presentation-only substitutions. `PublicCustomerForm` and
`BookingConfirmation` (`apps/web/src/components/`) are unchanged and still
render with the dashboard's rounded/pill styling — they're out of scope
for this chunk (see `apps/web/src/components/`'s protected status) and
this is the one place the "Your details" step still looks like the old
system.

## What was deliberately left out

- No per-client dynamic accent color on public pages (unlike the
  dashboard's `config.business.primaryColor`) — the brief specified fixed
  hex tokens for this design system.
- No social media links in the footer — no schema field backs them.
- No map/GPS block on Contact — no maps integration exists yet.
- No fabricated stats (member counts, live occupancy, "grid telemetry") —
  every number on these pages traces to a real `GET /catalog` field.
