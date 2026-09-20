import { db, users } from "@localos/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { verifyPassword, hashPassword } from "../auth/password.js";
import { isRateLimited, LOGIN_RATE_LIMIT } from "../auth/rateLimiter.js";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  deleteOtherSessions,
  readSessionToken,
  setSessionCookie,
} from "../auth/session.js";
import { ApiError } from "../errors.js";
import { ChangePasswordSchema } from "../validation.js";

export const authRouter = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/auth/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const { email, password } = parsed.data;

  // Checked before touching the users table, so a rate-limited caller
  // can't use response timing to distinguish "no such user" from "wrong
  // password" either.
  const rateLimitKey = `login:${email.toLowerCase()}:${req.ip}`;
  if (isRateLimited(rateLimitKey, LOGIN_RATE_LIMIT)) {
    throw new ApiError(429, "too many login attempts, try again later");
  }

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError(401, "invalid email or password");
  }
  // Same generic message as a wrong password, not "this account is
  // deactivated" — consistent with the rate limiter's reasoning above:
  // don't let the error response distinguish account states an attacker
  // could otherwise enumerate.
  if (user.status !== "active") {
    throw new ApiError(401, "invalid email or password");
  }

  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  // Same shape as GET /auth/me (id, email, role, staffId) — no reason for
  // "who am I right after logging in" to look different from "who am I
  // right now."
  res.json({ id: user.id, email: user.email, role: user.role, staffId: user.staffId });
});

authRouter.post("/auth/logout", async (req, res) => {
  const token = readSessionToken(req);
  if (token) {
    await deleteSession(token);
  }
  clearSessionCookie(res);
  res.status(204).send();
});

authRouter.post("/auth/change-password", async (req, res) => {
  const parsed = ChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "invalid request");
  }
  const { currentPassword, newPassword } = parsed.data;

  // requireAuth guarantees req.user is set here — this route is not in
  // PUBLIC_ROUTES.
  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, req.user!.id))
    .limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ApiError(401, "current password is incorrect");
  }

  const newHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

  // Keep the session that made this request alive; sign every other
  // session for this account out.
  const currentToken = readSessionToken(req);
  if (currentToken) {
    await deleteOtherSessions(user.id, currentToken);
  }

  res.status(204).send();
});

authRouter.get("/auth/me", (req, res) => {
  // requireAuth isn't exempted for this route, so req.user is guaranteed
  // set by the time this handler runs (otherwise it already returned 401).
  res.json(req.user);
});
