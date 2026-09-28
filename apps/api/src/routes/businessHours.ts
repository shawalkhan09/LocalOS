import { businessHours, db } from "@localos/db";
import { Router } from "express";
import { requireOwner } from "../auth/middleware.js";
import { ApiError } from "../errors.js";
import { CreateBusinessHoursSchema } from "../validation.js";

export const businessHoursRouter = Router();

// GET is not needed as a separate route — GET /catalog already serves
// business hours (see routes/catalog.ts).
//
// Replace-all semantics, same as a settings form: the body is the full
// week, not a single day. Delete every existing row and insert the new
// set in one transaction, so the table never ends up half-updated (e.g.
// a request that fails partway through leaving some days from the old
// week and some from the new). A day omitted from the array is simply
// not re-inserted, i.e. closed — same "no entry = closed" contract as
// before.
businessHoursRouter.patch("/business-hours", requireOwner, async (req, res) => {
  const parsed = CreateBusinessHoursSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const updated = await db.transaction(async (tx) => {
    await tx.delete(businessHours);
    if (parsed.data.length === 0) {
      return [];
    }
    return tx.insert(businessHours).values(parsed.data).returning();
  });

  res.json(updated);
});
