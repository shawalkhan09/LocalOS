import { businessInfo, db } from "@localos/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { requireOwner } from "../auth/middleware.js";
import { ApiError } from "../errors.js";
import { UpdateBusinessInfoSchema } from "../validation.js";

export const businessInfoRouter = Router();

// GET is not needed as a separate route — GET /catalog already serves
// business info (see routes/catalog.ts).
//
// Single-row update, not replace-all like business-hours: business_info
// always has exactly one row (id "default") after the cutover script has
// run, so this is a plain UPDATE rather than a delete+insert.
businessInfoRouter.patch("/business-info", requireOwner, async (req, res) => {
  const parsed = UpdateBusinessInfoSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const [updated] = await db
    .update(businessInfo)
    .set(parsed.data)
    .where(eq(businessInfo.id, "default"))
    .returning();
  if (!updated) {
    throw new ApiError(500, "business_info has no row — has the migrate:business-info cutover run?");
  }
  res.json(updated);
});
