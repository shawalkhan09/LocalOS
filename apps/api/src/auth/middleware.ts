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
// Every other route (customers, bookings, class-bookings, memberships)
// requires a session this round because the only caller today is the
// internal dashboard, not because that's the final shape — POST /bookings
// and POST /customers will need revisiting once unauthenticated customer
// self-service exists.
const PUBLIC_ROUTES: ReadonlyArray<{ method: string; path: string }> = [
  { method: "GET", path: "/health" },
  { method: "GET", path: "/catalog" },
  { method: "GET", path: "/bookings/check-availability" },
  { method: "POST", path: "/auth/login" },
  { method: "POST", path: "/auth/logout" },
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
