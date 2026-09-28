import { db, membershipPlans } from "@localos/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { requireOwner } from "../auth/middleware.js";
import { ApiError } from "../errors.js";
import { CreateMembershipPlanSchema, UpdateMembershipPlanSchema } from "../validation.js";

export const membershipPlansRouter = Router();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Readable, deploy-config-style ids (e.g. "plan-monthly-unlimited"),
// consistent with the hand-authored ids the migration round preserved —
// not a random UUID. Collisions (two plans with the same name) get a
// numeric suffix. Same pattern as generateServiceId in routes/services.ts.
async function generateMembershipPlanId(name: string): Promise<string> {
  const base = `plan-${slugify(name) || "plan"}`;
  let candidate = base;
  for (let suffix = 2; ; suffix++) {
    const [existing] = await db
      .select({ id: membershipPlans.id })
      .from(membershipPlans)
      .where(eq(membershipPlans.id, candidate))
      .limit(1);
    if (!existing) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
  }
}

// price is a Postgres `numeric` column, which drizzle-orm types as a
// string to avoid float precision loss on round-trip — CreateMembershipPlanSchema/
// UpdateMembershipPlanSchema validate it as a JSON number (matching the old
// config.json shape and MembershipPlanSchema in @localos/config-schema), so
// it's converted at the boundary here, same place stripNulls/Number()
// convert it back the other way in routes/catalog.ts.

membershipPlansRouter.post("/membership-plans", requireOwner, async (req, res) => {
  const parsed = CreateMembershipPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const id = await generateMembershipPlanId(parsed.data.name);
  const [created] = await db
    .insert(membershipPlans)
    .values({ id, ...parsed.data, price: String(parsed.data.price) })
    .returning();
  res.status(201).json({ ...created, price: Number(created.price) });
});

// Deliberately narrow, same pattern as PATCH /services/:id: no id field
// (ids are immutable once generated — memberships already reference it).
membershipPlansRouter.patch("/membership-plans/:id", requireOwner, async (req, res) => {
  const planId = req.params.id as string;
  const parsed = UpdateMembershipPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const { price, ...rest } = parsed.data;
  const [updated] = await db
    .update(membershipPlans)
    .set(price === undefined ? rest : { ...rest, price: String(price) })
    .where(eq(membershipPlans.id, planId))
    .returning();
  if (!updated) {
    throw new ApiError(404, `unknown planId "${planId}"`);
  }
  res.json({ ...updated, price: Number(updated.price) });
});

// Unlike services (see routes/services.ts's comment on the bookings FK),
// membershipPlans.id has no FK anywhere — planId is validated against this
// table at the API layer instead (see bookingRules.ts's findMembershipPlan),
// not enforced at the database level. So there's no 409-on-referenced-row
// case to protect against here: just delete and 404 if missing.
membershipPlansRouter.delete("/membership-plans/:id", requireOwner, async (req, res) => {
  const planId = req.params.id as string;
  const [deleted] = await db.delete(membershipPlans).where(eq(membershipPlans.id, planId)).returning();
  if (!deleted) {
    throw new ApiError(404, `unknown planId "${planId}"`);
  }
  res.status(204).end();
});
