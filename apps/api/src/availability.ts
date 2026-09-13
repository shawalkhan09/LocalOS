import type { Weekday } from "@localos/config-schema";
import { bookings, db } from "@localos/db";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { DateTime } from "luxon";

// Converts a business-local "HH:MM" on a given calendar date into a real
// instant, using `timezone` (business.timezone) to resolve what that wall
// clock time actually means in UTC. Never do naive `new Date(...)` math
// here — the server's own timezone has nothing to do with the business's.
export function localTimeToInstant(date: string, timezone: string, time: string): DateTime {
  const [hour, minute] = time.split(":").map(Number);
  return DateTime.fromISO(date, { zone: timezone }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
}

// The [start, end) instants spanning a whole calendar date as observed in
// the business's own timezone — e.g. for filtering "today's" bookings
// without naive UTC date matching.
export function localDayRange(date: string, timezone: string): { start: DateTime; end: DateTime } {
  const start = DateTime.fromISO(date, { zone: timezone }).startOf("day");
  return { start, end: start.plus({ days: 1 }) };
}

// Weekday of a calendar date as observed in the business's own timezone,
// not the server's — a date can be a different weekday depending on zone.
export function localWeekday(date: string, timezone: string): Weekday {
  return DateTime.fromISO(date, { zone: timezone })
    .setLocale("en-US")
    .toFormat("cccc")
    .toLowerCase() as Weekday;
}

export function overlaps(aStart: DateTime, aEnd: DateTime, bStart: DateTime, bEnd: DateTime): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function generateCandidateSlots(params: {
  open: DateTime;
  close: DateTime;
  durationMinutes: number;
  stepMinutes: number;
}): { start: DateTime; end: DateTime }[] {
  const lastStart = params.close.minus({ minutes: params.durationMinutes });
  const slots: { start: DateTime; end: DateTime }[] = [];
  let cursor = params.open;
  while (cursor <= lastStart) {
    slots.push({ start: cursor, end: cursor.plus({ minutes: params.durationMinutes }) });
    cursor = cursor.plus({ minutes: params.stepMinutes });
  }
  return slots;
}

// Bookings with no staffId aren't scoped to any resource — same rule the
// EXCLUDE constraint in packages/db/src/schema.ts applies — so there is
// nothing to conflict against and this always returns no rows for them.
export async function findStaffBookingsInRange(
  staffId: string,
  start: DateTime,
  end: DateTime,
): Promise<{ startTime: Date; endTime: Date }[]> {
  return db
    .select({ startTime: bookings.startTime, endTime: bookings.endTime })
    .from(bookings)
    .where(
      and(
        eq(bookings.staffId, staffId),
        ne(bookings.status, "cancelled"),
        lt(bookings.startTime, end.toJSDate()),
        gt(bookings.endTime, start.toJSDate()),
      ),
    );
}

export async function findOverlappingBooking(
  staffId: string | undefined,
  start: DateTime,
  end: DateTime,
): Promise<{ startTime: Date; endTime: Date } | undefined> {
  if (staffId === undefined) {
    return undefined;
  }
  const rows = await findStaffBookingsInRange(staffId, start, end);
  return rows[0];
}
