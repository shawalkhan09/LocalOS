import { bookings, db } from "@localos/db";
import { Router } from "express";
import { clientConfig } from "../config.js";
import { ApiError } from "../errors.js";
import { CreateBookingSchema } from "../validation.js";

export const bookingsRouter = Router();

bookingsRouter.post("/bookings", async (req, res) => {
  const parsed = CreateBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const { customerId, serviceId, staffId, startTime, endTime } = parsed.data;

  if (!clientConfig.services.some((s) => s.id === serviceId)) {
    throw new ApiError(400, `unknown serviceId "${serviceId}"`);
  }
  if (staffId !== undefined && !clientConfig.staff.some((s) => s.id === staffId)) {
    throw new ApiError(400, `unknown staffId "${staffId}"`);
  }

  const [booking] = await db
    .insert(bookings)
    .values({ customerId, serviceId, staffId, startTime, endTime })
    .returning();
  res.status(201).json(booking);
});

bookingsRouter.get("/bookings", async (_req, res) => {
  const rows = await db.select().from(bookings).limit(100);
  res.json(rows);
});
