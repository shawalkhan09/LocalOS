import { bookings, db } from "@localos/db";
import { and, gte, lt } from "drizzle-orm";
import { Router } from "express";
import { DateTime } from "luxon";
import { findOverlappingBooking, localDayRange } from "../availability.js";
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

  const service = clientConfig.services.find((s) => s.id === serviceId);
  if (!service) {
    throw new ApiError(400, `unknown serviceId "${serviceId}"`);
  }
  if (staffId !== undefined && !clientConfig.staff.some((s) => s.id === staffId)) {
    throw new ApiError(400, `unknown staffId "${staffId}"`);
  }

  // Config-mismatch error, checked before the overlap check: a staff member
  // who isn't qualified for this service is wrong regardless of whether
  // they're free at the requested time. Undefined/empty staffIds means the
  // service has no restriction — unchanged from before this field existed.
  if (service.staffIds && service.staffIds.length > 0) {
    if (staffId === undefined || !service.staffIds.includes(staffId)) {
      throw new ApiError(
        400,
        `staffId "${staffId ?? "none"}" is not qualified for service "${serviceId}"`,
      );
    }
  }

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

  const [booking] = await db
    .insert(bookings)
    .values({ customerId, serviceId, staffId, startTime, endTime })
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
