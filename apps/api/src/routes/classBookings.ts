import { classBookings, db } from "@localos/db";
import { and, eq, ne } from "drizzle-orm";
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

  const gymClass = clientConfig.classes.find((c) => c.id === classId);
  if (!gymClass) {
    throw new ApiError(400, `unknown classId "${classId}"`);
  }

  // Application-level only: counts existing rows and compares to capacity
  // before inserting. Two concurrent requests can both read the same count,
  // both pass, and both insert — overrunning capacity by (at most) the
  // number of racing requests. A real guarantee would need a DB trigger or
  // a counter column with a CHECK constraint, which is more than this round
  // needs. This is an accepted, documented gap, not an oversight — unlike
  // the staffId overlap check, there is no DB-level backstop for this one
  // yet.
  const existing = await db
    .select({ id: classBookings.id })
    .from(classBookings)
    .where(
      and(
        eq(classBookings.classId, classId),
        eq(classBookings.occurrenceDate, occurrenceDate),
        ne(classBookings.status, "cancelled"),
      ),
    );
  if (existing.length >= gymClass.capacity) {
    throw new ApiError(409, `class "${classId}" is at capacity for ${occurrenceDate}`);
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
