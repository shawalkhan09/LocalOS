# LocalOS owner dashboard — design plan

## Subject

An internal ops screen a gym owner or front-desk staffer glances at mid-shift,
between customers, often on a small screen near a noisy front desk. The job
is answering "what's happening right now and what's next" in under a few
seconds — not persuading anyone of anything. Every choice below is judged
against that job, not against what looks impressive in a screenshot.

## Pass 1 — plan

### Color

| Token | Value | Role |
|---|---|---|
| `--bg` | `#F6F7F8` | Page background — cool light neutral |
| `--surface` | `#FFFFFF` | Cards, table rows, sidebar — bordered, not shadowed |
| `--border` | `#E3E5E8` | Dividers, table rules, card outlines |
| `--ink` | `#1C2024` | Primary text |
| `--ink-muted` | `#5B6470` | Secondary text — timestamps, helper copy, table meta |
| `--accent` | `#0F6E5C` | Primary actions, active nav state, "confirmed" — nothing else |
| `--warn` | `#B45309` | "At capacity," warnings — never used for anything else |
| `--error` | `#B3261E` | Failed bookings, destructive states |
| `--success` | `#15803D` | Booking-confirmed toast — distinct from `--accent` so "this is the primary action color" and "this succeeded" stay two different signals |

Reasoning: the brief's starting palette already does the work of avoiding
the cream/terracotta and near-black/neon defaults, and it's grounded in the
subject — teal and amber read as clinical/operational (think status
indicators on gym equipment, not a consumer brand), not decorative. The one
addition is `--success`, needed because the brief calls for toasts on
booking success/failure and reusing `--accent` for "succeeded" would blur
the rule that teal means "primary action," not "this went well." Kept it in
the same cool, muted register as teal and amber rather than a stock
Bootstrap green.

### Type

- **Space Grotesk** — headings, sidebar nav, table column headers, stat
  numbers (today's booking count, class fill counts). Slightly technical and
  geometric; reads as instrumentation, not marketing.
- **IBM Plex Sans** — body copy, table cell content, form labels and inputs.
  Designed by IBM specifically for dense interface and data-table
  legibility at small sizes, which is the actual constraint here (a phone
  screen at a front desk), not just a stylistic pairing.

Two families, clearly split by job (structural/label vs. content), not one
default family stretched across every role.

### Layout

Persistent left sidebar (business name from config, three nav items: Today,
Customers, New Booking), dense left-aligned main content, real `<table>`
markup for bookings/customers/classes. Borders and whitespace carry
structure; shadow is reserved for the modal and the availability dropdown,
where it signals actual elevation above the page.

```
Desktop / tablet (≥640px):
┌────────────┬──────────────────────────────────────────┐
│ IRONCLAD    │  Today                                    │
│ FITNESS     │  Tue, Sep 15                               │
│─────────── │                                            │
│ ● Today     │  Bookings                                  │
│   Customers │  Time    Customer     Service      Staff   │
│   New       │  9:00    Jane Doe     PT Session   Priya   │
│   Booking   │  ...                                       │
│             │                                             │
│             │  Classes                                   │
│             │  Strength Fundamentals      7/10    09:00  │
│             │  ...                                       │
└────────────┴──────────────────────────────────────────┘

Mobile (<640px): sidebar becomes a fixed bottom bar (3 icons + labels),
content is full width above it. Not a hamburger — nav stays visible and
reachable by thumb, it just moves to where a phone held at a front desk
makes it reachable.
┌──────────────────────────────┐
│  Today                        │
│  Tue, Sep 15                  │
│  ...                          │
│                                │
├──────────────────────────────┤
│  Today   Customers   New       │
└──────────────────────────────┘
```

Alignment: left-aligned throughout. This is a scanning tool — centered
content would force the eye to re-find the start of every line.

### Principles

1. **Scanning over storytelling.** Every screen answers "what do I need to
   know right now" without opening anything. No detail hidden behind an
   accordion or a second click that a front-desk person doesn't have time
   for.
2. **Real tables, not cards.** Bookings and customers are rows of
   comparable facts — alignment and whitespace should carry that structure,
   not rounded corners and shadows standing in for it.
3. **Two accents, two fixed jobs.** Teal = primary action / active state.
   Amber = "pay attention." Never interchanged, never decorative.
4. **One motion moment.** A booking row confirms with a brief highlight
   flash. Nothing else animates on load, scroll, or hover.

## Pass 2 — critique against the banned tells

Checked against both the brief's explicit list and the skill's five
generic AI-tells:

- **Cream+terracotta / near-black+neon** — not present; palette is cool
  neutral + teal/amber, confirmed above.
- **Uniform rounded-card-with-shadow** — avoided by using real tables with
  borders for the two data-heavy pages; the one place a "card" appears
  (nothing does, structurally — sidebar and content are both plain
  bordered panels) stays that way rather than becoming a shadowed tile.
- **ALL-CAPS eyebrow labels** — none planned. Table column headers use
  sentence case, small size, and `--ink-muted` to read as headers without
  reaching for tracked-out caps — caps-with-letter-spacing is reserved for
  nothing in this build.
- **Meta text joined with middot/spaced em dash** — the class row's
  "7/10" fill count and its time are separate table columns, not a joined
  string, so this doesn't come up structurally. Anywhere else meta needs
  joining (e.g. a toast body), plain words or separate lines are used
  instead of `·` or ` — `.
- **Monospace for ordinary labels** — none. Numbers (prices, fill counts,
  times) render in IBM Plex Sans with tabular figures via
  `font-variant-numeric: tabular-nums` for column alignment, not a
  monospace typeface.
- **Arrows on buttons/links** — none; buttons say what they do ("Confirm
  booking," "Save customer"), no trailing `→`.
- **Fade-and-slide-up on every section** — none; the only motion is the
  one booking-confirmation highlight named in principle 4.

Nothing in the plan drifted toward a default that needed revising going
into pass 2 — the brief's starting values were already specific to this
subject, so this pass confirmed rather than corrected. The one genuine
design decision left open by the brief was the mobile nav treatment,
resolved above (bottom bar, not a hamburger) and reasoned through against
the "usable at 375px" + "not a hamburger" constraints together.

## Accessibility floor

- Text contrast ≥4.5:1 — `--ink` (`#1C2024`) on `--bg`/`--surface` is
  ~15:1; `--ink-muted` (`#5B6470`) on white is ~5.3:1; `--accent` and
  `--warn` are only ever used as backgrounds behind white text or as large
  text/icons, checked individually where used.
- Visible focus rings on every interactive element (`:focus-visible`, not
  `outline: none`).
- `prefers-reduced-motion: reduce` disables the booking-confirmation
  highlight (shows the end state immediately instead).
- Layout usable down to 375px width (verified with the mobile bottom nav
  above).

## Addendum — the public booking page

Everything above is for the dashboard. The public site (`/` and the
booking flow) is a different product for a different person, and gets its
own read, not a reskin of the ops tool.

**Subject.** A prospective or existing member on their phone, mid-scroll
through something else, deciding whether to book a class tonight. The job
is "make me want to come in, then get me booked in under a minute" — the
opposite of the dashboard's "scan fast, feel nothing." Mobile-first this
time: this person is on a phone far more often than a gym owner is
checking the dashboard from one.

**Color.** The accent is `business.primaryColor` from config, applied as a
CSS custom property set at render time — never hardcoded, since a second
client's page must look nothing like Ironclad's on this axis alone. For
Ironclad specifically that resolves to `#E63946`, a bold coral-red — energetic
and athletic, and deliberately far from the dashboard's muted teal, so the
two surfaces never get mistaken for the same system. Background stays a
clean, close-to-white neutral (`#FAFAFA`) — warmer than the dashboard's
cool `#F6F7F8` since this page is allowed some warmth, but still nowhere
near the banned cream-plus-terracotta combination (the accent here is a
config-driven red, not a fixed terracotta, and it's used boldly on CTAs
and highlights, not as a muted decorative wash).

**Type.** Same two families as the dashboard (Space Grotesk, IBM Plex
Sans) — one type system for the product as a whole is a legitimate choice,
not a shortcut, and it avoids loading a third typeface for no functional
reason. The distinction from the dashboard comes from how they're used:
larger display sizes for the hero, more generous line-height and spacing,
pill-shaped buttons instead of the dashboard's square-cornered utilitarian
ones — scale and shape carry the "this is a storefront, not a tool"
signal, not a font swap.

**Layout.** Single-column, mobile-first, generous vertical rhythm: hero
(name, logo if present, one-line description, today's hours), services,
two clear CTAs into the two booking tracks ("Book a session" /
"Book a class") — not one blended flow, since the schema itself treats
one-off bookings and recurring classes as genuinely different things.
Cards here use soft rounded corners and a light shadow deliberately,
unlike the dashboard's bordered-not-shadowed rule — real elevation is
appropriate on a page that's selling a visit, not filing a fact.

**What's still banned:** the same list as the dashboard — no ALL-CAPS
eyebrows, no meta text joined with middle dots or spaced em dashes, no
monospace for ordinary labels, no arrows appended to buttons, no
fade-and-slide-up on every section. The booking-confirmed state gets one
deliberate moment (a checkmark/confirmation card appearing), not a
page-load animation sequence.
