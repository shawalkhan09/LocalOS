import { db, users } from "@localos/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { verifyPassword } from "../auth/password.js";
import { isRateLimited, LOGIN_RATE_LIMIT } from "../auth/rateLimiter.js";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  readSessionToken,
  setSessionCookie,
} from "../auth/session.js";
import { ApiError } from "../errors.js";

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
  res.json({ email: user.email, role: user.role });
});

authRouter.post("/auth/logout", async (req, res) => {
  const token = readSessionToken(req);
  if (token) {
    await deleteSession(token);
  }
  clearSessionCookie(res);
  res.status(204).send();
});

authRouter.get("/auth/me", (req, res) => {
  // requireAuth isn't exempted for this route, so req.user is guaranteed
  // set by the time this handler runs (otherwise it already returned 401).
  res.json(req.user);
});
