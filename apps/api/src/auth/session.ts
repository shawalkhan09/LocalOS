import crypto from "node:crypto";
import { db, sessions, users } from "@localos/db";
import { and, eq, ne } from "drizzle-orm";
import type { Request, Response } from "express";

export const SESSION_COOKIE_NAME = "localos_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type SessionUser = {
  id: number;
  email: string;
  role: "owner" | "staff";
  staffId: string | null;
};

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  // 256 bits from the OS CSPRNG — not enumerable/guessable, which is the
  // whole point of using a random token instead of a serial int as the
  // session id (see the comment on the sessions table in packages/db).
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  return { token, expiresAt };
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token));
}

// Used by change-password: the session that made the request stays
// valid, every other session for this account is signed out. This is
// NOT the same as deactivation's full sign-out below — that one has no
// "current session" to preserve because it's an admin acting on
// someone else's account.
export async function deleteOtherSessions(userId: number, keepToken: string): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, keepToken)));
}

// SameSite=None because apps/web and apps/api run on different origins
// (different ports in dev, likely different domains in prod) — a
// cross-origin cookie needs SameSite=None, which browsers only honor
// alongside Secure. SameSite=None also means the browser attaches this
// cookie to cross-site requests, so SameSite provides no CSRF protection
// here on its own — see the X-LocalOS-Client header check in app.ts,
// combined with the strict CORS origin allowlist, for the actual
// mitigation.
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  path: "/",
};

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE_NAME, token, { ...COOKIE_OPTIONS, expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
}

export function readSessionToken(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const name = part.slice(0, separatorIndex).trim();
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }
  return undefined;
}

// Expired sessions are treated as invalid here but not purged from the
// table — an accepted gap for this round, not an oversight; a real
// deployment would want a periodic cleanup job.
//
// This is the actual enforcement point for deactivation, not just a
// convenience check: PATCH /users/:id deletes a deactivated user's
// sessions rows immediately (see routes/users.ts), but that alone isn't
// airtight against every future code path that might create a session
// without going through the same logic. Checking status here, on every
// authenticated request, is what guarantees a deactivated account's
// access actually stops — belt and suspenders, and the suspenders are the
// one that can't be bypassed by a bug elsewhere.
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const token = readSessionToken(req);
  if (!token) {
    return null;
  }
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      staffId: users.staffId,
      status: users.status,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt.getTime() <= Date.now() || row.status !== "active") {
    return null;
  }
  return { id: row.id, email: row.email, role: row.role, staffId: row.staffId };
}
