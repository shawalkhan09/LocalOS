import { db, sessions, users } from "@localos/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { requireOwner } from "../auth/middleware.js";
import { hashPassword } from "../auth/password.js";
import { assertStaffExists } from "../bookingRules.js";
import { ApiError } from "../errors.js";
import { CreateUserSchema, UpdateUserSchema, ResetPasswordSchema } from "../validation.js";

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

  if (staffId !== undefined) {
    await assertStaffExists(staffId);
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

// Deliberately narrow: only email, status, and staffId can change here.
// Role is a bigger permissions question than this round covers — out of
// scope, not silently ignored: UpdateUserSchema is .strict(), so a request
// that includes it is rejected with 400, not quietly accepted and no-op'd.
//
// email is fair game here even though self-service email changes stay
// correctly out of scope everywhere else: the owner already has full
// authority over every account this endpoint touches — they set the
// password, they can deactivate it, they created it in the first place.
// Correcting a typo in an account you already fully control carries none
// of the re-verification risk (proving you still own the new address)
// that made self-service changes worth deferring — there's no new party
// to verify, just a correction to data the owner already governs.
usersRouter.patch("/users/:id", async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ApiError(400, "invalid user id");
  }

  const parsed = UpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const { email, status, staffId } = parsed.data;

  // The owner deactivating their own account would lock the business out
  // of its own dashboard with no other owner to undo it. Editing their own
  // email carries no equivalent risk — sessions key off user id, not
  // email (see auth/session.ts), so this doesn't touch their own access at
  // all, let alone anyone else's — no special-case rejection needed here.
  if (status === "deactivated" && userId === req.user?.id) {
    throw new ApiError(400, "you cannot deactivate your own account");
  }

  if (staffId !== undefined && staffId !== null) {
    await assertStaffExists(staffId);
  }

  // Only include keys that were actually provided — email/status/staffId
  // are all optional in the schema (staffId is also nullable, for explicit
  // unlinking), so an absent key must leave the existing column alone
  // rather than overwriting it with undefined. A duplicate email hits the
  // users.email unique constraint, mapped to a friendly 409 in app.ts —
  // same as account creation, no parallel "check first" logic needed here.
  const updates: Partial<{ email: string; status: "active" | "deactivated"; staffId: string | null }> = {};
  if (email !== undefined) {
    updates.email = email;
  }
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

usersRouter.post("/users/:id/reset-password", async (req, res) => {
  const userId = Number(req.params.id);
  if (userId === req.user?.id) {
    throw new ApiError(400, "use change password to update your own account, not reset");
  }
  const parsed = ResetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!rows[0]) {
    throw new ApiError(404, "account not found");
  }
  const newHash = await hashPassword(parsed.data.newPassword);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));
  // Full forced logout — same pattern as deactivation elsewhere in this
  // file. This is an admin action on someone else's account, so there
  // is no "current session" to preserve.
  await db.delete(sessions).where(eq(sessions.userId, userId));
  res.status(204).send();
});
