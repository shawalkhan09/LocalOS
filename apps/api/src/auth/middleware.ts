import type { NextFunction, Request, Response } from "express";
import { getSessionUser, type SessionUser } from "./session.js";

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

// Explicit allowlist, not an implicit "everything not under /auth is
// protected" rule — every entry here is a deliberate exemption, reasoned
// about individually:
//   - GET /health, GET /catalog: carry no PII.
//   - GET /bookings/check-availability: will need to be callable by an
//     unauthenticated customer once the public booking flow exists — this
//     boundary is being set correctly now rather than reopened later.
//   - POST /auth/login: how you become authenticated in the first place.
//   - POST /auth/logout: idempotent and safe unauthenticated — it only
//     ever clears whatever session cookie is present, if any.
//   - POST /public/bookings, POST /public/class-bookings: this is the
//     unauthenticated customer self-service the comment below used to say
//     "will need revisiting" for — it's now built, with its own
//     find-or-create-by-email flow and its own rate limit (see
//     routes/public.ts), deliberately separate from the staff-only
//     POST /bookings and POST /customers below, which stay session-gated.
// Every other route (customers, bookings, class-bookings, memberships)
// requires a session because the only caller for *those* routes is the
// internal dashboard — staff booking on a customer's behalf, or managing
// the customer list, are still staff-only actions.
const PUBLIC_ROUTES: ReadonlyArray<{ method: string; path: string }> = [
  { method: "GET", path: "/health" },
  { method: "GET", path: "/catalog" },
  { method: "GET", path: "/bookings/check-availability" },
  { method: "POST", path: "/auth/login" },
  { method: "POST", path: "/auth/logout" },
  { method: "POST", path: "/public/bookings" },
  { method: "POST", path: "/public/class-bookings" },
];

export function isPublicRoute(method: string, path: string): boolean {
  return PUBLIC_ROUTES.some((route) => route.method === method && route.path === path);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (isPublicRoute(req.method, req.path)) {
    next();
    return;
  }
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "authentication required" });
    return;
  }
  req.user = user;
  next();
}
