import { Router } from "express";
import { DateTime } from "luxon";
import { z } from "zod";
import {
  findStaffBookingsInRange,
  generateCandidateSlots,
  localTimeToInstant,
  localWeekday,
  overlaps,
} from "../availability.js";
import { assertStaffExists } from "../bookingRules.js";
import { clientConfig } from "../config.js";
import { ApiError } from "../errors.js";

export const availabilityRouter = Router();

const CheckAvailabilityQuerySchema = z.object({
  serviceId: z.string().min(1),
  staffId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
});

availabilityRouter.get("/bookings/check-availability", async (req, res) => {
  const parsed = CheckAvailabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }
  const { serviceId, staffId, date } = parsed.data;

  const service = clientConfig.services.find((s) => s.id === serviceId);
  if (!service) {
    throw new ApiError(400, `unknown serviceId "${serviceId}"`);
  }
  if (staffId !== undefined) {
    await assertStaffExists(staffId);
  }

  const timezone = clientConfig.business.timezone;
  const requestedDate = DateTime.fromISO(date, { zone: timezone }).startOf("day");
  if (!requestedDate.isValid) {
    throw new ApiError(400, `invalid date "${date}"`);
  }

  // A date outside the booking window is a caller-side mistake, not "no
  // availability" — reject with 400 rather than returning empty slots, so
  // it can't be mistaken for a correctly-checked, fully-booked day.
  const today = DateTime.now().setZone(timezone).startOf("day");
  const latestBookable = today.plus({ days: clientConfig.booking.advanceBookingDays });
  if (requestedDate < today) {
    throw new ApiError(400, `date "${date}" is in the past`);
  }
  if (requestedDate > latestBookable) {
    throw new ApiError(
      400,
      `date "${date}" is beyond the ${clientConfig.booking.advanceBookingDays}-day advance booking window`,
    );
  }

  const weekday = localWeekday(date, timezone);
  const hoursSlot = clientConfig.businessHours.find((slot) => slot.day === weekday);
  if (!hoursSlot) {
    // No entry for this weekday means closed — an empty slots array, not an
    // error.
    res.json({ date, slots: [] });
    return;
  }

  const open = localTimeToInstant(date, timezone, hoursSlot.openTime);
  const close = localTimeToInstant(date, timezone, hoursSlot.closeTime);
  const candidates = generateCandidateSlots({
    open,
    close,
    durationMinutes: service.durationMinutes,
    stepMinutes: clientConfig.booking.slotIntervalMinutes,
  });

  const existingBookings =
    staffId !== undefined ? await findStaffBookingsInRange(staffId, open, close) : [];

  const now = DateTime.now().setZone(timezone);
  const slots = candidates
    .filter((candidate) => candidate.start >= now)
    .filter(
      (candidate) =>
        !existingBookings.some((b) =>
          overlaps(candidate.start, candidate.end, DateTime.fromJSDate(b.startTime), DateTime.fromJSDate(b.endTime)),
        ),
    )
    .map((c) => ({ startTime: c.start.toUTC().toISO(), endTime: c.end.toUTC().toISO() }));

  res.json({ date, slots });
});
