import { classBookings, db } from "@localos/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { DateTime } from "luxon";
import { assertBookableClassOccurrence } from "../bookingWindow.js";
import { assertNotAlreadyInClass, findGymClass, isClassAtCapacity } from "../bookingRules.js";
import { clientConfig } from "../config.js";
import { ApiError } from "../errors.js";
import { CreateClassBookingSchema, DateQuerySchema } from "../validation.js";

export const classBookingsRouter = Router();

classBookingsRouter.post("/class-bookings", async (req, res) => {
  const parsed = CreateClassBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const { customerId, classId, occurrenceDate } = parsed.data;

  const gymClass = findGymClass(clientConfig, classId);
  assertBookableClassOccurrence({
    gymClass,
    occurrenceDate,
  });
  if (await isClassAtCapacity(classId, occurrenceDate, gymClass.capacity)) {
    throw new ApiError(409, `class "${classId}" is at capacity for ${occurrenceDate}`);
  }

  await assertNotAlreadyInClass(customerId, classId, occurrenceDate);

  const [classBooking] = await db
    .insert(classBookings)
    .values({ customerId, classId, occurrenceDate })
    .returning();
  res.status(201).json(classBooking);
});

classBookingsRouter.get("/class-bookings", async (req, res) => {
  const parsed = DateQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const { date } = parsed.data;

  // occurrenceDate is a plain date column, not an instant — a direct string
  // match is correct here, no timezone conversion needed (unlike bookings).
  const rows = await db
    .select()
    .from(classBookings)
    .where(date !== undefined ? eq(classBookings.occurrenceDate, date) : undefined)
    .limit(100);
  res.json(rows);
});
