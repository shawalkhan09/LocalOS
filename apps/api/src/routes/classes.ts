import { classes, db, trainerProfiles } from "@localos/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { requireOwner } from "../auth/middleware.js";
import { ApiError } from "../errors.js";
import { CreateClassSchema, UpdateClassSchema } from "../validation.js";

export const classesRouter = Router();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Readable, deploy-config-style ids (e.g. "class-strength-101"), consistent
// with the hand-authored ids the migration round preserved — not a random
// UUID. Collisions (two classes with the same name) get a numeric suffix.
// Same pattern as generateServiceId in routes/services.ts.
async function generateClassId(name: string): Promise<string> {
  const base = `class-${slugify(name) || "class"}`;
  let candidate = base;
  for (let suffix = 2; ; suffix++) {
    const [existing] = await db.select({ id: classes.id }).from(classes).where(eq(classes.id, candidate)).limit(1);
    if (!existing) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
  }
}

async function assertTrainerExists(trainerId: string): Promise<void> {
  const [row] = await db
    .select({ id: trainerProfiles.id })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.id, trainerId))
    .limit(1);
  if (!row) {
    throw new ApiError(404, `unknown trainerId "${trainerId}"`);
  }
}

// trainerId is validated against trainer_profiles here, at save time — same
// spirit as the runtime check already in routes/catalog.ts, just moved
// earlier so a bad trainerId fails fast on save instead of only surfacing
// later on GET /catalog.
classesRouter.post("/classes", requireOwner, async (req, res) => {
  const parsed = CreateClassSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  await assertTrainerExists(parsed.data.trainerId);

  const id = await generateClassId(parsed.data.name);
  const [created] = await db
    .insert(classes)
    .values({ id, ...parsed.data })
    .returning();
  res.status(201).json(created);
});

// Deliberately narrow, same pattern as PATCH /services/:id: no id field
// (ids are immutable once generated — class_bookings already references it).
classesRouter.patch("/classes/:id", requireOwner, async (req, res) => {
  const classId = req.params.id as string;
  const parsed = UpdateClassSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  if (parsed.data.trainerId !== undefined) {
    await assertTrainerExists(parsed.data.trainerId);
  }

  const [updated] = await db.update(classes).set(parsed.data).where(eq(classes.id, classId)).returning();
  if (!updated) {
    throw new ApiError(404, `unknown classId "${classId}"`);
  }
  res.json(updated);
});

// Same reasoning as DELETE /services/:id: the class_bookings.class_id FK
// (see packages/db/src/schema.ts) is the actual guarantee — deleting a
// class still referenced by a booking is rejected at the database level
// and surfaced as a friendly 409 by app.ts's error handler.
classesRouter.delete("/classes/:id", requireOwner, async (req, res) => {
  const classId = req.params.id as string;
  const [deleted] = await db.delete(classes).where(eq(classes.id, classId)).returning();
  if (!deleted) {
    throw new ApiError(404, `unknown classId "${classId}"`);
  }
  res.status(204).end();
});
