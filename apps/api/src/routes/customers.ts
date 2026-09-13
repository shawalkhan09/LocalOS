import { customers, db } from "@localos/db";
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

customersRouter.get("/customers", async (_req, res) => {
  const rows = await db.select().from(customers).limit(100);
  res.json(rows);
});
