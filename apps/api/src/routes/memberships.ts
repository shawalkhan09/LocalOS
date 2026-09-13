import { db, memberships } from "@localos/db";
import { Router } from "express";
import { clientConfig } from "../config.js";
import { ApiError } from "../errors.js";
import { CreateMembershipSchema } from "../validation.js";

export const membershipsRouter = Router();

membershipsRouter.post("/memberships", async (req, res) => {
  const parsed = CreateMembershipSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const { customerId, planId, startDate, renewalDate, creditsRemaining } = parsed.data;

  if (!clientConfig.membershipPlans.some((p) => p.id === planId)) {
    throw new ApiError(400, `unknown planId "${planId}"`);
  }

  const [membership] = await db
    .insert(memberships)
    .values({ customerId, planId, startDate, renewalDate, creditsRemaining })
    .returning();
  res.status(201).json(membership);
});

membershipsRouter.get("/memberships", async (_req, res) => {
  const rows = await db.select().from(memberships).limit(100);
  res.json(rows);
});
