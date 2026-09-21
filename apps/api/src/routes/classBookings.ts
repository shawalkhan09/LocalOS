import { classBookings, db } from "@localos/db";
import { and, eq, isNull, or } from "drizzle-orm";
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

// Same reasoning as POST /bookings/:id/cancel: any authenticated role may
// call this, one atomic conditional update (not check-then-update) so two
// concurrent cancels can't both succeed, and time of day is irrelevant.
classBookingsRouter.post("/class-bookings/:id/cancel", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "id must be a positive integer");
  }

  const [cancelled] = await db
    .update(classBookings)
    .set({ status: "cancelled" })
    .where(and(eq(classBookings.id, id), or(isNull(classBookings.status), eq(classBookings.status, "booked"))))
    .returning();

  if (cancelled) {
    res.json(cancelled);
    return;
  }

  const [existing] = await db.select().from(classBookings).where(eq(classBookings.id, id)).limit(1);
  if (!existing) {
    throw new ApiError(404, "Booking not found.");
  }
  if (existing.status === "cancelled") {
    throw new ApiError(409, "This booking is already cancelled.");
  }
  throw new ApiError(409, "Only class bookings that are still booked can be cancelled.");
});
