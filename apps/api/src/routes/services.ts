import { db, services } from "@localos/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { requireOwner } from "../auth/middleware.js";
import { ApiError } from "../errors.js";
import { CreateServiceSchema, UpdateServiceSchema } from "../validation.js";

export const servicesRouter = Router();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Readable, deploy-config-style ids (e.g. "svc-personal-training"),
// consistent with the hand-authored ids the migration round preserved —
// not a random UUID. Collisions (two services with the same name) get a
// numeric suffix. Same pattern as generateStaffId in routes/staff.ts.
async function generateServiceId(name: string): Promise<string> {
  const base = `svc-${slugify(name) || "service"}`;
  let candidate = base;
  for (let suffix = 2; ; suffix++) {
    const [existing] = await db.select({ id: services.id }).from(services).where(eq(services.id, candidate)).limit(1);
    if (!existing) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
  }
}

// price is a Postgres `numeric` column, which drizzle-orm types as a
// string to avoid float precision loss on round-trip — CreateServiceSchema/
// UpdateServiceSchema validate it as a JSON number (matching the old
// config.json shape and ServiceSchema in @localos/config-schema), so it's
// converted at the boundary here, same place stripNulls/Number() convert
// it back the other way in routes/catalog.ts.

servicesRouter.post("/services", requireOwner, async (req, res) => {
  const parsed = CreateServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const id = await generateServiceId(parsed.data.name);
  const [created] = await db
    .insert(services)
    .values({ id, ...parsed.data, price: String(parsed.data.price) })
    .returning();
  res.status(201).json({ ...created, price: Number(created.price) });
});

// Deliberately narrow, same pattern as PATCH /staff/:id: no id field (ids
// are immutable once generated — bookings already reference it).
servicesRouter.patch("/services/:id", requireOwner, async (req, res) => {
  const serviceId = req.params.id as string;
  const parsed = UpdateServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const { price, ...rest } = parsed.data;
  const [updated] = await db
    .update(services)
    .set(price === undefined ? rest : { ...rest, price: String(price) })
    .where(eq(services.id, serviceId))
    .returning();
  if (!updated) {
    throw new ApiError(404, `unknown serviceId "${serviceId}"`);
  }
  res.json({ ...updated, price: Number(updated.price) });
});

// Unlike staff (see routes/staff.ts's comment on why it has no DELETE),
// a service can be removed outright — the bookings.service_id FK (see
// packages/db/src/schema.ts) is the actual guarantee: deleting a service
// still referenced by a booking is rejected at the database level and
// surfaced as a friendly 409 by app.ts's error handler, not a silent
// orphan or a raw Postgres error.
servicesRouter.delete("/services/:id", requireOwner, async (req, res) => {
  const serviceId = req.params.id as string;
  const [deleted] = await db.delete(services).where(eq(services.id, serviceId)).returning();
  if (!deleted) {
    throw new ApiError(404, `unknown serviceId "${serviceId}"`);
  }
  res.status(204).end();
});
