import { db, staff, trainerProfiles } from "@localos/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { requireOwner } from "../auth/middleware.js";
import { ApiError } from "../errors.js";
import {
  CreateStaffSchema,
  CreateTrainerProfileSchema,
  UpdateStaffSchema,
  UpdateTrainerProfileSchema,
} from "../validation.js";

export const staffRouter = Router();

// Owner-only, same reasoning as usersRouter — see requireOwner's comment in
// auth/middleware.ts.
staffRouter.use(requireOwner);

// No DELETE routes this round, deliberately: a staff member can be
// referenced by bookings/users history (real FKs now — see packages/db's
// schema), so removing one is a "deactivate, don't delete" question same
// as PATCH /users/:id already answered for accounts, not a plain delete —
// and un-marking someone as a trainer needs its own thinking about what
// happens to classes still pointing at their trainerId. Both need their
// own round rather than a partial version bolted on here.

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Readable, deploy-config-style ids (e.g. "staff-jordan"), consistent with
// the hand-authored ids the migration round preserved — not a random UUID.
// Collisions (two staff with the same name) get a numeric suffix.
async function generateStaffId(name: string): Promise<string> {
  const base = `staff-${slugify(name) || "member"}`;
  let candidate = base;
  for (let suffix = 2; ; suffix++) {
    const [existing] = await db.select({ id: staff.id }).from(staff).where(eq(staff.id, candidate)).limit(1);
    if (!existing) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
  }
}

// A trainer profile's id is derived from its staffId, not generated
// independently — "trainer-priya" for "staff-priya", matching the ids the
// migration round preserved. Deterministic and collision-free by
// construction: a given staffId can have at most one trainer profile (see
// the 409 check below), so it can never need more than one derived id.
function deriveTrainerId(staffId: string): string {
  return staffId.startsWith("staff-") ? `trainer-${staffId.slice("staff-".length)}` : `trainer-${staffId}`;
}

staffRouter.post("/staff", async (req, res) => {
  const parsed = CreateStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const id = await generateStaffId(parsed.data.name);
  const [created] = await db
    .insert(staff)
    .values({ id, ...parsed.data })
    .returning();
  res.status(201).json(created);
});

// Deliberately narrow, same pattern as PATCH /users/:id: only the staff
// fields themselves. No id field (ids are immutable once generated —
// everything else in the system already references it) and no way to
// attach/detach a trainer profile here (that's the dedicated
// /staff/:id/trainer-profile routes below).
staffRouter.patch("/staff/:id", async (req, res) => {
  const staffId = req.params.id;
  const parsed = UpdateStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const [updated] = await db.update(staff).set(parsed.data).where(eq(staff.id, staffId)).returning();
  if (!updated) {
    throw new ApiError(404, `unknown staffId "${staffId}"`);
  }
  res.json(updated);
});

// Create-only: a staff member either has a trainer profile or doesn't (see
// packages/db's schema comment — that presence/absence IS the "is this
// person a trainer" signal). A second POST for someone who already has one
// is a 409, not a silent overwrite; PATCH below is how an existing profile
// gets edited.
staffRouter.post("/staff/:id/trainer-profile", async (req, res) => {
  const staffId = req.params.id;
  const parsed = CreateTrainerProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const [staffRow] = await db.select({ id: staff.id }).from(staff).where(eq(staff.id, staffId)).limit(1);
  if (!staffRow) {
    throw new ApiError(404, `unknown staffId "${staffId}"`);
  }

  const [existingProfile] = await db
    .select({ id: trainerProfiles.id })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.staffId, staffId))
    .limit(1);
  if (existingProfile) {
    throw new ApiError(409, `staff "${staffId}" already has a trainer profile`);
  }

  const id = deriveTrainerId(staffId);
  const [created] = await db
    .insert(trainerProfiles)
    .values({ id, staffId, ...parsed.data })
    .returning();
  res.status(201).json(created);
});

staffRouter.patch("/staff/:id/trainer-profile", async (req, res) => {
  const staffId = req.params.id;
  const parsed = UpdateTrainerProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const [updated] = await db
    .update(trainerProfiles)
    .set(parsed.data)
    .where(eq(trainerProfiles.staffId, staffId))
    .returning();
  if (!updated) {
    throw new ApiError(404, `no trainer profile exists yet for staffId "${staffId}"`);
  }
  res.json(updated);
});
