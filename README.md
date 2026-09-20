# LocalOS

A config-driven booking, CRM and dashboard platform for local service businesses.

## Live Demo

Visit the live demo at https://localos-gym-demo.vercel.app (Ironclad Fitness, a fictional gym). The API runs on a free tier, so the first request after a period of inactivity may take up to about a minute to respond.

## Features

- Customer management with soft-delete archive/unarchive
- Booking system with comprehensive time validation (past time rejection, business hours enforcement, advance-booking window, duration matching, double-booking prevention, class-weekday validation)
- Timezone-aware scheduling (Luxon-based, per-business configured timezone, not server timezone)
- Password management (self-service change-password, owner-only reset-password)
- Staff account linking (one-to-one constraint via database partial unique index)
- Staff schedule view (upcoming sessions and classes for next 14 days)
- Mobile-friendly account menu
- Two authentication roles: owner (full admin) and staff (limited access)

## Architecture

Single-tenant per deployment: one core engine, configured per business, deployed separately per client with its own database. Never multi-tenant SaaS.

- **apps/api**: Express server, handles bookings, customers, authentication, staff management
- **apps/web**: Next.js front-end dashboard for staff and owner
- **packages/config-schema**: Zod schemas defining per-business configuration (services, classes, staff, etc.)
- **packages/db**: Drizzle ORM with Postgres migrations

## Stack

- Frontend: Next.js, Luxon (timezone handling), Intl APIs for localization
- Backend: Express, Node.js
- Database: PostgreSQL with Drizzle ORM
- Auth: opaque session tokens in httpOnly cookies, bcrypt password hashing
- Deployment: Vercel (web), Render (API, free tier), Neon (Postgres, free tier)

## Local Development

### Prerequisites

- Node.js 20+ and npm
- PostgreSQL running locally (default: localhost:5432)
- Git

### Install

```bash
npm install
```

### Environment Setup

Create `.env.local` files in each app:

**apps/api/.env.local**:
```
DATABASE_URL=postgres://localhost:5432/localos
ALLOWED_ORIGIN=http://localhost:3001
OWNER_EMAIL=owner@example.com
OWNER_PASSWORD=change-me
```

**apps/web/.env.local**:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Database

Create a local PostgreSQL database named "localos" (or adjust DATABASE_URL in .env.local). Migrations are automatically applied when the API starts.

### Run Locally

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

Deploy app configuration via clients/{name}/config.json per business.

## Project Status

See STATUS.md for what has shipped, known issues, and the roadmap.
