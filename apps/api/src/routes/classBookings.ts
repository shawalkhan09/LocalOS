import { classBookings, db } from "@localos/db";
import { Router } from "express";
import { clientConfig } from "../config.js";
import { ApiError } from "../errors.js";
import { CreateClassBookingSchema } from "../validation.js";

export const classBookingsRouter = Router();

classBookingsRouter.post("/class-bookings", async (req, res) => {
  const parsed = CreateClassBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const { customerId, classId, occurrenceDate } = parsed.data;

  if (!clientConfig.classes.some((c) => c.id === classId)) {
    throw new ApiError(400, `unknown classId "${classId}"`);
  }

  const [classBooking] = await db
    .insert(classBookings)
    .values({ customerId, classId, occurrenceDate })
    .returning();
  res.status(201).json(classBooking);
});

classBookingsRouter.get("/class-bookings", async (_req, res) => {
  const rows = await db.select().from(classBookings).limit(100);
  res.json(rows);
});
