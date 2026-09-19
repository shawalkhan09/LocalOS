import { customers, db } from "@localos/db";
import { eq, isNotNull, isNull } from "drizzle-orm";
import { Router } from "express";
import { ApiError } from "../errors.js";
import { CreateCustomerSchema } from "../validation.js";

export const customersRouter = Router();

customersRouter.post("/customers", async (req, res) => {
  const parsed = CreateCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const [customer] = await db.insert(customers).values(parsed.data).returning();
  res.status(201).json(customer);
});

customersRouter.get("/customers", async (req, res) => {
  const archived = req.query.archived;
  let rows;
  if (archived === "true") {
    rows = await db.select().from(customers).where(isNotNull(customers.archivedAt)).limit(100);
  } else if (archived === "all") {
    rows = await db.select().from(customers).limit(100);
  } else {
    rows = await db.select().from(customers).where(isNull(customers.archivedAt)).limit(100);
  }
  res.json(rows);
});

customersRouter.post("/customers/:id/archive", async (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw new ApiError(400, "invalid customer id");
  }

  const [existing] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!existing) {
    throw new ApiError(404, "customer not found");
  }

  const [updated] = await db
    .update(customers)
    .set({ archivedAt: new Date() })
    .where(eq(customers.id, customerId))
    .returning();

  res.json(updated);
});

customersRouter.post("/customers/:id/unarchive", async (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw new ApiError(400, "invalid customer id");
  }

  const [existing] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!existing) {
    throw new ApiError(404, "customer not found");
  }

  const [updated] = await db
    .update(customers)
    .set({ archivedAt: null })
    .where(eq(customers.id, customerId))
    .returning();

  res.json(updated);
});
