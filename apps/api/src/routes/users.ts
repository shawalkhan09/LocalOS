import { db, users } from "@localos/db";
import { Router } from "express";
import { requireOwner } from "../auth/middleware.js";
import { hashPassword } from "../auth/password.js";
import { clientConfig } from "../config.js";
import { ApiError } from "../errors.js";
import { CreateUserSchema } from "../validation.js";

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
