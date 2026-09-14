import { db, sessions, users } from "@localos/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { requireOwner } from "../auth/middleware.js";
import { hashPassword } from "../auth/password.js";
import { clientConfig } from "../config.js";
import { ApiError } from "../errors.js";
import { CreateUserSchema, UpdateUserSchema } from "../validation.js";

export const usersRouter = Router();

// Owner-only: the first, and so far only, admin action in the API. See
// requireOwner's comment in auth/middleware.ts for why this doesn't imply
// a broader per-role permission system yet.
usersRouter.use(requireOwner);

// Explicit column list on every read/write of this table, never a bare
// select()/returning() — passwordHash must never leave this file, and
// listing columns by name here makes that true by construction rather
// than by remembering to strip a field out of the response later.
const ACCOUNT_COLUMNS = {
  id: users.id,
  email: users.email,
  role: users.role,
  status: users.status,
  staffId: users.staffId,
  createdAt: users.createdAt,
};

usersRouter.post("/users", async (req, res) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const { email, password, staffId } = parsed.data;

  if (staffId !== undefined && !clientConfig.staff.some((s) => s.id === staffId)) {
    throw new ApiError(400, `unknown staffId "${staffId}"`);
  }

  // A duplicate email hits the existing users.email unique constraint and
  // is handled by the 23505 -> 409 mapping already in app.ts's error
  // handler — no parallel "check first" logic needed here.
  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(users)
    .values({ email, passwordHash, role: "staff", staffId })
    .returning(ACCOUNT_COLUMNS);
  res.status(201).json(created);
});

usersRouter.get("/users", async (_req, res) => {
  const rows = await db.select(ACCOUNT_COLUMNS).from(users);
  res.json(rows);
});

// Deliberately narrow: only status and staffId can change here. Email
// changes need re-verification (nothing to send a confirmation link
// with yet — no email infra, same reasoning that already deferred
// password reset) and role changes are a bigger permissions question
// than this round covers — both out of scope, not silently ignored:
// UpdateUserSchema is .strict(), so a request that includes either key
// is rejected with 400, not quietly accepted and no-op'd.
usersRouter.patch("/users/:id", async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ApiError(400, "invalid user id");
  }

  const parsed = UpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const { status, staffId } = parsed.data;

  // The owner deactivating their own account would lock the business out
  // of its own dashboard with no other owner to undo it.
  if (status === "deactivated" && userId === req.user?.id) {
    throw new ApiError(400, "you cannot deactivate your own account");
  }

  if (staffId !== undefined && staffId !== null && !clientConfig.staff.some((s) => s.id === staffId)) {
    throw new ApiError(400, `unknown staffId "${staffId}"`);
  }

  // Only include keys that were actually provided — status/staffId are
  // both optional in the schema (staffId is also nullable, for explicit
  // unlinking), so an absent key must leave the existing column alone
  // rather than overwriting it with undefined.
  const updates: Partial<{ status: "active" | "deactivated"; staffId: string | null }> = {};
  if (status !== undefined) {
    updates.status = status;
  }
  if (staffId !== undefined) {
    updates.staffId = staffId;
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning(ACCOUNT_COLUMNS);
  if (!updated) {
    throw new ApiError(404, "user not found");
  }

  // Invalidate immediately, not just block future logins (see routes/
  // auth.ts's login status check for that half) — otherwise a deactivated
  // staff member stays logged in until their existing cookie expires on
  // its own, up to 7 days later. requireAuth's own status check (see
  // auth/session.ts) is the real belt-and-suspenders backstop if this
  // delete were ever skipped, but this is what makes it immediate rather
  // than "eventually, next time they'd have queried the DB anyway."
  if (status === "deactivated") {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  res.json(updated);
});
