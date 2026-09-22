import { bookings, db } from "@localos/db";
import { and, eq, gte, isNull, lt, or } from "drizzle-orm";
import { Router } from "express";
import { DateTime } from "luxon";
import { assertBookableSessionTime } from "../bookingWindow.js";
import { findOverlappingBooking, localDayRange } from "../availability.js";
import { assertCustomerFree, assertStaffQualified, computeNoShowRisk, findService } from "../bookingRules.js";
import { clientConfig } from "../config.js";
import { ApiError } from "../errors.js";
import { CreateBookingSchema, DateQuerySchema } from "../validation.js";

export const bookingsRouter = Router();

bookingsRouter.post("/bookings", async (req, res) => {
  const parsed = CreateBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const { customerId, serviceId, staffId, startTime, endTime } = parsed.data;

  const service = findService(clientConfig, serviceId);
  assertBookableSessionTime({
    service,
    startTime: DateTime.fromJSDate(startTime),
    endTime: DateTime.fromJSDate(endTime),
  });
  await assertStaffQualified(service, staffId);

  // Friendly, immediate check — the DB's EXCLUDE constraint (see
  // packages/db/src/schema.ts) is the actual guarantee if two requests race
  // past this point; this just avoids a raw 23P01 round trip for the
  // common, non-racing case.
  const conflict = await findOverlappingBooking(
    staffId,
    DateTime.fromJSDate(startTime),
    DateTime.fromJSDate(endTime),
  );
  if (conflict) {
    throw new ApiError(
      409,
      `staff member "${staffId}" is already booked from ${conflict.startTime.toISOString()} to ${conflict.endTime.toISOString()}`,
    );
  }

  await assertCustomerFree(customerId, DateTime.fromJSDate(startTime), DateTime.fromJSDate(endTime));

  // Computed once, at creation time, not recalculated later: the stored
  // score reflects what was known about this customer when the booking was
  // made, not their history since. Re-scoring on every read would make the
  // number silently drift underneath a booking that already happened.
  const noShowRiskScore = await computeNoShowRisk(customerId, startTime);

  const [booking] = await db
    .insert(bookings)
    .values({ customerId, serviceId, staffId, startTime, endTime, noShowRiskScore: noShowRiskScore.toString() })
    .returning();
  res.status(201).json(booking);
});

bookingsRouter.get("/bookings", async (req, res) => {
  const parsed = DateQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const { date } = parsed.data;

  if (date === undefined) {
    const rows = await db.select().from(bookings).limit(100);
    res.json(rows);
    return;
  }

  // Filters on the calendar date as observed in business.timezone, not a
  // naive UTC date match — a booking at 2026-09-14T23:30:00-06:00 is on the
  // 14th locally even though its UTC instant falls on the 15th.
  const { start, end } = localDayRange(date, clientConfig.business.timezone);
  const rows = await db
    .select()
    .from(bookings)
    .where(and(gte(bookings.startTime, start.toJSDate()), lt(bookings.startTime, end.toJSDate())))
    .limit(100);
  res.json(rows);
});

// Any authenticated role (owner or staff) may cancel — cancelling never
// deletes a row, only sets status to 'cancelled', so there's no extra
// permission risk here beyond what viewing the schedule already grants.
// Time of day is irrelevant: a past booking can be cancelled the same as a
// future one (e.g. correcting the record after a no-show call was wrong).
bookingsRouter.post("/bookings/:id/cancel", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "id must be a positive integer");
  }

  // One atomic conditional update, not a check-then-update: only a row
  // that is still confirmed (or has a null status) gets cancelled, so two
  // concurrent cancel requests can't both "succeed" against the same slot.
  const [cancelled] = await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(and(eq(bookings.id, id), or(isNull(bookings.status), eq(bookings.status, "confirmed"))))
    .returning();

  if (cancelled) {
    res.json(cancelled);
    return;
  }

  const [existing] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!existing) {
    throw new ApiError(404, "Booking not found.");
  }
  if (existing.status === "cancelled") {
    throw new ApiError(409, "This booking is already cancelled.");
  }
  throw new ApiError(409, "Only bookings that are still confirmed can be cancelled.");
});
