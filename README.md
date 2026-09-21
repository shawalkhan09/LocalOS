# LocalOS

A config-driven booking, CRM and dashboard platform for local service businesses.

## Live Demo

Visit the live demo at https://localos-gym-demo.vercel.app (Ironclad Fitness, a fictional gym). The API runs on a free tier, so the first request after a period of inactivity may take up to about a minute to respond.

## Features

- Customer management with soft-delete archive/unarchive
- Booking system with comprehensive validation: past time rejection, business hours enforcement, advance-booking window, duration matching, double-booking prevention, class-weekday validation, seat limit enforcement
- Timezone-aware scheduling: business timezone configured per deployment, enforced API-side via Luxon, displayed client-side via Intl.DateTimeFormat (not server timezone or browser timezone)
- Public customer booking flows for sessions and classes
- Owner dashboard (Today page): view bookings and classes; each booking shows a rule-based no-show risk (Low/Medium/High) from the customer's past no-show rate, with a capped baseline for first-time customers
- Staff schedule view: logged-in staff see their own upcoming sessions and classes for the next 14 days
- Staff and owner accounts: owner-only account creation and email correction; owner can deactivate and reactivate staff accounts
- Membership plans defined in config (price, billing interval, perks), with customer memberships recorded through the API (start and renewal dates, credits remaining)
- Password management: self-service change (keeps current session, signs out others), owner-only reset (forces full logout)
- Staff roster management (owner only): create and edit staff profiles and trainer profiles
- Staff account linking: one-to-one database constraint between staff profiles and login accounts
- Two authentication roles: owner (full admin) and staff (limited access)

## Architecture

Single-tenant per deployment: one core engine, configured per business, deployed separately per client with its own database. This is deliberately not a multi-tenant SaaS.

- **apps/api**: Express server, handles bookings, customers, authentication, staff management
- **apps/web**: Next.js front-end dashboard for staff and owner
- **packages/config-schema**: Zod schemas for per-business configuration (business info, services, booking settings, business hours, classes, membership plans)
- **packages/db**: Drizzle ORM with Postgres migrations

## Stack

- Frontend: Next.js, React; timezone handling via Intl.DateTimeFormat
- Backend: Express, Node.js; Luxon for API-side date/time logic
- Database: PostgreSQL with Drizzle ORM
- Auth: opaque session tokens in httpOnly cookies, bcrypt password hashing
- Deployment: Vercel (web), Render (API, free tier), Neon (Postgres, free tier)

## Local Development

### Prerequisites

- Node.js 20 or later (tested on v22.22.2) and npm
- PostgreSQL running locally (default: localhost:5432)
- Git

### Install

```bash
npm install
```

### Environment Setup

For the API, export environment variables in your shell:
```bash
export OWNER_EMAIL=owner@example.com
export OWNER_PASSWORD=change-me
```

`DATABASE_URL` defaults to `postgres://localhost:5432/localos`, `ALLOWED_ORIGIN` to `http://localhost:3001`, and `PORT` to `3000`. Set them only if you need different values.

For the web app, `NEXT_PUBLIC_API_URL` defaults to `http://localhost:3000` in development. No environment file needed locally.

### Database Setup

Create a local PostgreSQL database named "localos" (or set DATABASE_URL to point at another local database):

```bash
psql postgres -c "CREATE DATABASE localos;"
```

Then apply schema migrations from packages/db:

```bash
(cd packages/db && npx drizzle-kit migrate)
```

Optional: seed demo no-show history (for testing the no-show risk feature):

```bash
npm -w packages/db run seed:demo
```

Run both commands from the repo root.

### Run Locally

Start the API first (it occupies port 3000); the web dev server will take the next available port.

Terminal 1 - API server:
```bash
npm -w apps/api run dev
```

Terminal 2 - Web app:
```bash
npm -w apps/web run dev
```

The web app will be at http://localhost:3001 and the API at http://localhost:3000.

### TypeCheck and Build

```bash
npm -w apps/web run typecheck
npm -w apps/web run build
npm -w apps/api run typecheck
```

## Deployment

Vercel hosts apps/web (automatic on push to main). Render hosts apps/api (requires manual "Deploy latest commit" click). Neon provides the PostgreSQL database.

Each deployment loads configuration from a business-specific config file (default: `clients/gym-demo/config.json`). Configure services, classes, membership plans, business hours, timezone, and booking settings per client.

## Project Status

See STATUS.md for what has shipped, known issues, and what's next.
