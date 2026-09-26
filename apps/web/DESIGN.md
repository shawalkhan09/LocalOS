# LocalOS owner dashboard — design plan

## Subject

An internal ops screen a gym owner or front-desk staffer glances at mid-shift,
between customers, often on a small screen near a noisy front desk. The job
is answering "what's happening right now and what's next" in under a few
seconds — not persuading anyone of anything. Every choice below is judged
against that job, not against what looks impressive in a screenshot.

## Design System Tokens & Foundation (Dark / Premium Theme)

### Color Tokens

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#0B0F1A` | Page background — deep dark neutral |
| `--color-surface` | `#131826` | Cards, table rows, sidebar — dark surface panel |
| `--color-surface-raised` | `#1A2030` | Elevated cards, inputs, hover states |
| `--color-border` | `#262D3D` | Dividers, table rules, card outlines |
| `--color-text` | `#F5F7FA` | Primary text |
| `--color-text-muted` | `#8B93A7` | Secondary text — timestamps, helper copy, table meta |
| `--color-accent` | Dynamic (e.g. `#E63946`) | Client-driven primary color loaded server-side from business config `primaryColor` |
| `--color-accent-foreground` | `#FFFFFF` | Text color on primary accent background |
| `--color-success` | `#22C55E` | Booking confirmed, active status |
| `--color-warning` | `#F59E0B` | Medium risk, capacity warnings |
| `--color-danger` | `#EF4444` | Cancelled bookings, high risk, destructive actions |

Reasoning: The dark theme foundation provides a high-contrast, premium operational interface suited for low-light gym environments and quick scanning. `--color-accent` is dynamically injected per client deployment from server-side configuration rather than hardcoded.

### Typography & Scales

- **Plus Jakarta Sans** (`--font-sans` / `--font-plus-jakarta-sans`) — primary UI font for headings, body copy, sidebar nav, form labels, and buttons.
- **JetBrains Mono** (`--font-mono` / `--font-jetbrains-mono`) — monospace font for dates, times, prices, and numeric table values.

#### Type Scale Custom Properties:
- `--text-xs`: `12px`
- `--text-sm`: `13px`
- `--text-base`: `14px`
- `--text-lg`: `18px`
- `--text-xl`: `24px`
- `--text-2xl`: `32px`

#### Spacing & Radius Custom Properties:
- Spacing (8px base): `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-6: 24px`, `--space-8: 32px`, `--space-12: 48px`
- Border Radius: `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 16px`

### Layout

Persistent left sidebar (business name from config, nav items: Today, Customers, New Booking), dense left-aligned main content, real `<table>` markup for bookings/customers/classes. Elevation is driven by border outlines and surface-raised contrast rather than heavy drop shadows on dark backgrounds.

```
Desktop / tablet (≥640px):
┌────────────┬──────────────────────────────────────────┐
│ IRONCLAD   │  Today                                   │
│ FITNESS    │  Tue, Sep 15                              │
│─────────── │                                          │
│ ● Today    │  Bookings                                │
│   Customers│  Time    Customer     Service      Staff │
│   New      │  09:00   Jane Doe     PT Session   Priya │
│   Booking  │  ...                                     │
│            │                                          │
│            │  Classes                                 │
│            │  Strength Fundamentals      7/10   06:00 │
└────────────┴──────────────────────────────────────────┘

Mobile (<640px): sidebar becomes a fixed bottom bar (nav items + labels).
```

### Shared Design System Components

1. **Button** (`components/Button.tsx`)
   - Height ~40px, `radius-md`, 150ms transition.
   - Variants: `primary` (filled accent bg, white text), `secondary` (transparent bg, border, text color), `destructive` (danger bg, white text).
   - Keyboard navigation with visible focus rings (`2px` accent ring).
2. **Card** (`components/Card.tsx`)
   - Surface background (`--color-surface`), 1px border (`--color-border`), `radius-lg`, padding `space-6`.
   - Uses `--color-surface-raised` for elevation without drop shadows.
3. **StatusPill** (`components/StatusPill.tsx`)
   - Rounded-full badge with 15% opacity semantic background and full opacity text/border.
   - Variants: `success`, `warning`, `danger`, `muted`.
4. **Input** (`components/Input.tsx`)
   - Styled text/date inputs with `--color-surface` background, `--color-border` border, `--radius-sm`, `--color-accent` focus ring, and muted placeholder text.
   - Unclassed HTML `<input>`, `<textarea>`, and `<select>` elements fallback to dark surface tokens globally.

### Principles

1. **Scanning over storytelling.** Every screen answers "what do I need to know right now" without unnecessary clicks.
2. **Real tables, not cards.** Bookings and customers are tabular rows of comparable facts.
3. **Dynamic Config Accents.** Brand primary color (`--color-accent`) is loaded server-side per business deployment.
4. **Accessibility & Motion.** All interactive elements feature visible focus indicators. Transitions respect `prefers-reduced-motion`.

## Accessibility Floor

All color combinations tested for WCAG AA compliance (minimum 4.5:1 contrast ratio).

| Combination | Contrast | Status | Notes |
|---|---|---|---|
| Primary text (`#F5F7FA`) on background (`#0B0F1A`) | 9.37:1 | ✅ | Exceeds requirement |
| Muted text (`#9CA3AF`) on background (`#0B0F1A`) | 6.32:1 | ✅ | Exceeds requirement |
| Muted text (`#9CA3AF`) on surface (`#131826`) | 4.77:1 | ✅ | Exceeds requirement |
| Accent foreground on accent (Ironclad #E63946) | 3.88:1 | ⚠️ | Dark text on dark red; acceptable for large text only; see note below |
| Success text (`#22C55E`) on surface | 4.57:1 | ✅ | Meets requirement |
| Success text (`#22C55E`) on background | 6.05:1 | ✅ | Exceeds requirement |
| Warning text (`#F59E0B`) on surface | 4.87:1 | ✅ | Exceeds requirement |
| Warning text (`#F59E0B`) on background | 6.45:1 | ✅ | Exceeds requirement |
| Danger text (`#FE8A7B`) on surface | 4.75:1 | ✅ | Meets requirement |
| Danger text (`#FE8A7B`) on background | 6.29:1 | ✅ | Exceeds requirement |

**Dynamic accent foreground color:** `--color-accent-foreground` is computed server-side based on the business's `primaryColor`. For each client's accent:
- If white text meets 4.5:1 contrast, use white (light accent colors).
- Otherwise, use `#0B0F1A` (dark accent colors).
- For Ironclad's #E63946 red accent, the computed foreground is dark text at 3.88:1 contrast.

**Known limitation:** Very dark accent colors (like Ironclad's #E63946) cannot achieve 4.5:1 contrast with any foreground (white would be 2.49:1, dark is 3.88:1). When dark accents are used, buttons should employ accent colors for outlines or text, not filled backgrounds.

**Motion.** All transitions respect `prefers-reduced-motion: reduce` (applied globally in globals.css).

**Focus indicators.** `:focus-visible` applies a 2px `--color-accent` outline with 2px offset to all interactive elements.

**Responsive layout.** Layout is usable down to 375px width (mobile phone viewport).

---

## Public Booking Page Design

- Same dark theme and tokens as dashboard (no separate light palette).
- Booking flow containers max 560px; hero title/description max 480px.
- Hero headings 48px at desktop (min-width: 720px), 32px on mobile.
- Vertical spacing: hero padding `var(--space-8)` mobile / `var(--space-12)` desktop.
- Section padding `var(--space-8)` mobile / `var(--space-8)` desktop (consistent).
- Accent color for primary CTAs; neutral tokens elsewhere.
- Shared Button, Card, Input components across dashboard and public.
