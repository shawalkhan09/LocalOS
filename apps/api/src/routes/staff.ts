import { customers as customersTable, db, bookings, staff, trainerProfiles } from "@localos/db";
import { and, eq, gte, lt, ne, inArray } from "drizzle-orm";
import { Router } from "express";
import { DateTime } from "luxon";
import { requireOwner } from "../auth/middleware.js";
import { ApiError } from "../errors.js";
import { clientConfig } from "../config.js";
import {
  CreateStaffSchema,
  CreateTrainerProfileSchema,
  UpdateStaffSchema,
  UpdateTrainerProfileSchema,
} from "../validation.js";

export const staffRouter = Router();

// Staff schedule endpoint: returns upcoming bookings and classes for the logged-in staff member.
// Available to any authenticated user, but only returns their own data (scoped by staffId).
staffRouter.get("/staff/me/schedule", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "authentication required" });
    return;
  }

  const staffId = req.user.staffId;
  if (!staffId) {
    res.json({ linked: false, items: [] });
    return;
  }

  const timezone = clientConfig.business.timezone;
  const now = DateTime.now().setZone(timezone);
  const endOfSchedule = now.plus({ days: 14 }).endOf("day");

  // Get bookings for this staff member
  const staffBookings = await db
    .select({
      id: bookings.id,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      serviceId: bookings.serviceId,
      customerId: bookings.customerId,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.staffId, staffId),
        ne(bookings.status, "cancelled"),
        gte(bookings.startTime, now.toJSDate()),
        lt(bookings.startTime, endOfSchedule.toJSDate()),
      ),
    );

  // Get trainer profile for this staff member
  const trainerRow = await db
    .select({ id: trainerProfiles.id })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.staffId, staffId))
    .limit(1);
  const trainerId = trainerRow[0]?.id;

  // Get class occurrences for classes taught by this trainer
  const classItems: Array<{
    startTime: DateTime;
    endTime: DateTime;
    classId: string;
    capacity: number;
  }> = [];
  if (trainerId) {
    // Find classes with this trainerId in config
    const classList = clientConfig.classes.filter((c) => c.trainerId === trainerId);
    const dayMap: Record<string, number> = {
      monday: 0,
      tuesday: 1,
      wednesday: 2,
      thursday: 3,
      friday: 4,
      saturday: 5,
      sunday: 6,
    };

    for (const gymClass of classList) {
      // Generate class occurrences for the next 14 days
      for (let d = 0; d < 14; d++) {
        const occurrenceDate = now.plus({ days: d }).toISODate();
        if (!occurrenceDate) continue;

        const dayName = DateTime.fromISO(occurrenceDate, { zone: timezone })
          .setLocale("en-US")
          .toFormat("cccc")
          .toLowerCase();

        const classDay = dayMap[dayName];
        const slot = gymClass.schedule.find((s) => dayMap[s.day] === classDay);

        if (slot) {
          const [hour, minute] = slot.startTime.split(":").map(Number);
          const startTime = DateTime.fromISO(occurrenceDate, { zone: timezone }).set({
            hour,
            minute,
            second: 0,
            millisecond: 0,
          });
          const endTime = startTime.plus({ minutes: gymClass.durationMinutes });

          if (startTime >= now && startTime < endOfSchedule) {
            classItems.push({
              startTime,
              endTime,
              classId: gymClass.id,
              capacity: gymClass.capacity,
            });
          }
        }
      }
    }
  }

  // Get customer names for bookings
  const customerRows = staffBookings.length > 0
    ? await db
        .select({ id: customersTable.id, name: customersTable.name })
        .from(customersTable)
        .where(inArray(customersTable.id, staffBookings.map((b) => b.customerId)))
    : [];

  // Combine and sort all items
  const items = [
    ...staffBookings.map((b) => {
      const startTime = DateTime.fromJSDate(b.startTime, { zone: timezone });
      const endTime = DateTime.fromJSDate(b.endTime, { zone: timezone });
      const customerName = customerRows.find((c) => c.id === b.customerId)?.name || "";
      const startISO = startTime.toISO();
      const endISO = endTime.toISO();
      return {
        type: "booking" as const,
        start: startISO || b.startTime.toISOString(),
        end: endISO || b.endTime.toISOString(),
        label: clientConfig.services.find((s) => s.id === b.serviceId)?.name || b.serviceId,
        customerName,
      };
    }),
    ...classItems.map((c) => {
      const startISO = c.startTime.toISO();
      const endISO = c.endTime.toISO();
      return {
        type: "class" as const,
        start: startISO || new Date().toISOString(),
        end: endISO || new Date().toISOString(),
        label: clientConfig.classes.find((cl) => cl.id === c.classId)?.name || c.classId,
        seatCount: c.capacity,
      };
    }),
  ].sort((a, b) => {
    const aTime = new Date(a.start).getTime();
    const bTime = new Date(b.start).getTime();
    return aTime - bTime;
  });

  res.json({ linked: true, items });
});

// No DELETE routes this round, deliberately: a staff member can be
// referenced by bookings/users history (real FKs now — see packages/db's
// schema), so removing one is a "deactivate, don't delete" question same
// as PATCH /users/:id already answered for accounts, not a plain delete —
// and un-marking someone as a trainer needs its own thinking about what
// happens to classes still pointing at their trainerId. Both need their
// own round rather than a partial version bolted on here.

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Readable, deploy-config-style ids (e.g. "staff-jordan"), consistent with
// the hand-authored ids the migration round preserved — not a random UUID.
// Collisions (two staff with the same name) get a numeric suffix.
async function generateStaffId(name: string): Promise<string> {
  const base = `staff-${slugify(name) || "member"}`;
  let candidate = base;
  for (let suffix = 2; ; suffix++) {
    const [existing] = await db.select({ id: staff.id }).from(staff).where(eq(staff.id, candidate)).limit(1);
    if (!existing) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
  }
}

// A trainer profile's id is derived from its staffId, not generated
// independently — "trainer-priya" for "staff-priya", matching the ids the
// migration round preserved. Deterministic and collision-free by
// construction: a given staffId can have at most one trainer profile (see
// the 409 check below), so it can never need more than one derived id.
function deriveTrainerId(staffId: string): string {
  return staffId.startsWith("staff-") ? `trainer-${staffId.slice("staff-".length)}` : `trainer-${staffId}`;
}

// Owner-only: the first, and so far only, admin action in the API. See
// requireOwner's comment in auth/middleware.ts for why this doesn't imply
// a broader per-role permission system yet.
staffRouter.post("/staff", requireOwner, async (req, res) => {
  const parsed = CreateStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const id = await generateStaffId(parsed.data.name);
  const [created] = await db
    .insert(staff)
    .values({ id, ...parsed.data })
    .returning();
  res.status(201).json(created);
});

// Deliberately narrow, same pattern as PATCH /users/:id: only the staff
// fields themselves. No id field (ids are immutable once generated —
// everything else in the system already references it) and no way to
// attach/detach a trainer profile here (that's the dedicated
// /staff/:id/trainer-profile routes below).
staffRouter.patch("/staff/:id", requireOwner, async (req, res) => {
  const staffId = req.params.id as string;
  const parsed = UpdateStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const [updated] = await db.update(staff).set(parsed.data).where(eq(staff.id, staffId)).returning();
  if (!updated) {
    throw new ApiError(404, `unknown staffId "${staffId}"`);
  }
  res.json(updated);
});

// Create-only: a staff member either has a trainer profile or doesn't (see
// packages/db's schema comment — that presence/absence IS the "is this
// person a trainer" signal). A second POST for someone who already has one
// is a 409, not a silent overwrite; PATCH below is how an existing profile
// gets edited.
staffRouter.post("/staff/:id/trainer-profile", requireOwner, async (req, res) => {
  const staffId = req.params.id as string;
  const parsed = CreateTrainerProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const [staffRow] = await db.select({ id: staff.id }).from(staff).where(eq(staff.id, staffId)).limit(1);
  if (!staffRow) {
    throw new ApiError(404, `unknown staffId "${staffId}"`);
  }

  const [existingProfile] = await db
    .select({ id: trainerProfiles.id })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.staffId, staffId))
    .limit(1);
  if (existingProfile) {
    throw new ApiError(409, `staff "${staffId}" already has a trainer profile`);
  }

  const id = deriveTrainerId(staffId);
  const [created] = await db
    .insert(trainerProfiles)
    .values({ id, staffId, ...parsed.data })
    .returning();
  res.status(201).json(created);
});

staffRouter.patch("/staff/:id/trainer-profile", requireOwner, async (req, res) => {
  const staffId = req.params.id as string;
  const parsed = UpdateTrainerProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.message);
  }

  const [updated] = await db
    .update(trainerProfiles)
    .set(parsed.data)
    .where(eq(trainerProfiles.staffId, staffId))
    .returning();
  if (!updated) {
    throw new ApiError(404, `no trainer profile exists yet for staffId "${staffId}"`);
  }
  res.json(updated);
});
