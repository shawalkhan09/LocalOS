import { bookings, classBookings, db } from "@localos/db";
import { Router } from "express";
import { DateTime } from "luxon";
import { isRateLimited, PUBLIC_BOOKING_RATE_LIMIT } from "../auth/rateLimiter.js";
import { findOverlappingBooking } from "../availability.js";
import {
  assertStaffQualified,
  computeNoShowRisk,
  findGymClass,
  findOrCreateCustomerByEmail,
  findService,
  isClassAtCapacity,
} from "../bookingRules.js";
import { clientConfig } from "../config.js";
import { ApiError } from "../errors.js";
import { PublicCreateBookingSchema, PublicCreateClassBookingSchema } from "../validation.js";

export const publicRouter = Router();

publicRouter.post("/public/bookings", async (req, res) => {
  // A script hammering the public form with fake bookings is the concern
  // here (there's no account to lock out, unlike login) — IP alone is the
  // meaningful signal, not IP+email, since a script can vary the email
  // trivially.
  if (isRateLimited(`public-booking:${req.ip}`, PUBLIC_BOOKING_RATE_LIMIT)) {
    throw new ApiError(429, "Too many booking attempts. Please try again in a few minutes.");
  }

  const parsed = PublicCreateBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "That booking request doesn't look right. Please check the form and try again.");
  }
  const { customerName, customerEmail, customerPhone, serviceId, staffId, startTime, endTime } = parsed.data;

  const service = findService(clientConfig, serviceId);
  await assertStaffQualified(service, staffId);

  // Same overlap check as the staff route (routes/bookings.ts) via the
  // shared findOverlappingBooking — only the wording differs here, since a
  // real customer needs plain language, not a raw backend message.
  const conflict = await findOverlappingBooking(
    staffId,
    DateTime.fromJSDate(startTime),
    DateTime.fromJSDate(endTime),
  );
  if (conflict) {
    throw new ApiError(409, "That time was just booked by someone else. Please choose another time.");
  }

  const customer = await findOrCreateCustomerByEmail({
    name: customerName,
    email: customerEmail,
    phone: customerPhone,
  });

  // Same rule, same call, as the staff route (routes/bookings.ts) — see
  // computeNoShowRisk in bookingRules.ts for the formula. Computed once,
  // at creation time, not recalculated later.
  const noShowRiskScore = await computeNoShowRisk(customer.id, startTime);

  const [booking] = await db
    .insert(bookings)
    .values({
      customerId: customer.id,
      serviceId,
      staffId,
      startTime,
      endTime,
      noShowRiskScore: noShowRiskScore.toString(),
    })
    .returning();
  res.status(201).json(booking);
});

// No-show risk scoring does not apply here: class_bookings has no
// noShowRiskScore column (only bookings does). Deliberately out of scope
// rather than something to quietly expand into — not an oversight.
publicRouter.post("/public/class-bookings", async (req, res) => {
  if (isRateLimited(`public-booking:${req.ip}`, PUBLIC_BOOKING_RATE_LIMIT)) {
    throw new ApiError(429, "Too many booking attempts. Please try again in a few minutes.");
  }

  const parsed = PublicCreateClassBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "That booking request doesn't look right. Please check the form and try again.");
  }
  const { customerName, customerEmail, customerPhone, classId, occurrenceDate } = parsed.data;

  const gymClass = findGymClass(clientConfig, classId);
  // Same capacity check as the staff route (routes/classBookings.ts) via
  // the shared isClassAtCapacity — only the wording differs.
  if (await isClassAtCapacity(classId, occurrenceDate, gymClass.capacity)) {
    throw new ApiError(409, "This class just filled up. Please choose another class or date.");
  }

  const customer = await findOrCreateCustomerByEmail({
    name: customerName,
    email: customerEmail,
    phone: customerPhone,
  });

  const [classBooking] = await db
    .insert(classBookings)
    .values({ customerId: customer.id, classId, occurrenceDate })
    .returning();
  res.status(201).json(classBooking);
});
