import type { GymConfig } from "@localos/config-schema";
import { bookings, classBookings, customers, db, staff, type Customer } from "@localos/db";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { ApiError } from "./errors.js";

// Shared by the staff-facing (routes/bookings.ts) and public
// (routes/public.ts) booking routes so these rules can't drift out of sync
// between the two callers — see prior rounds' "root cause, not symptom"
// pattern. Error wording stays generic/technical here on purpose: a
// correctly-built UI (staff dashboard or public page) never lets a caller
// reach these — the trainer picker only ever offers qualified staff, same
// as the earlier dashboard fix — so these are abuse/bug edge cases, not
// real user-facing paths. Genuinely reachable errors (overlap, capacity)
// are worded per-caller at the route level instead, see routes/bookings.ts
// and routes/public.ts.

export function findService(config: GymConfig, serviceId: string): GymConfig["services"][number] {
  const service = config.services.find((s) => s.id === serviceId);
  if (!service) {
    throw new ApiError(400, `unknown serviceId "${serviceId}"`);
  }
  return service;
}

export function findGymClass(config: GymConfig, classId: string): GymConfig["classes"][number] {
  const gymClass = config.classes.find((c) => c.id === classId);
  if (!gymClass) {
    throw new ApiError(400, `unknown classId "${classId}"`);
  }
  return gymClass;
}

// Staff moved from config.json into the database this round (see
// packages/db's `staff` table), so this is now a DB lookup instead of a
// config.staff scan — same 400-if-not-found contract as findService/
// findGymClass above.
export async function assertStaffExists(staffId: string): Promise<void> {
  const [row] = await db.select({ id: staff.id }).from(staff).where(eq(staff.id, staffId)).limit(1);
  if (!row) {
    throw new ApiError(400, `unknown staffId "${staffId}"`);
  }
}

export async function assertStaffQualified(
  service: GymConfig["services"][number],
  staffId: string | undefined,
): Promise<void> {
  if (staffId !== undefined) {
    await assertStaffExists(staffId);
  }
  if (service.staffIds && service.staffIds.length > 0) {
    if (staffId === undefined || !service.staffIds.includes(staffId)) {
      throw new ApiError(400, `staffId "${staffId ?? "none"}" is not qualified for service "${service.id}"`);
    }
  }
}

export async function isClassAtCapacity(
  classId: string,
  occurrenceDate: string,
  capacity: number,
): Promise<boolean> {
  // Application-level only — see the longer explanation this used to carry
  // inline in routes/classBookings.ts: two concurrent requests can both
  // read the same count and both insert, overrunning capacity by (at most)
  // the number of racing requests. Accepted gap, not an oversight; unlike
  // the staffId overlap check there is no DB-level backstop for this one
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
  return existing.length >= capacity;
}

// Public booking routes only — the staff dashboard's customer picker
// already does search-or-create through a human, so this is specific to
// unauthenticated customer self-service. Case-insensitive exact match
// (not ILIKE's wildcard-pattern semantics, which would treat a literal
// "%" in an email as a wildcard) so a returning customer's email always
// resolves to the same row regardless of capitalization, rather than
// silently creating a duplicate customer per visit.
export async function findOrCreateCustomerByEmail(data: {
  name: string;
  email: string;
  phone?: string;
}): Promise<Customer> {
  const existing = await db
    .select()
    .from(customers)
    .where(sql`lower(${customers.email}) = lower(${data.email})`)
    .limit(1);
  if (existing[0]) {
    if (existing[0].archivedAt !== null) {
      const [unarchived] = await db
        .update(customers)
        .set({ archivedAt: null })
        .where(eq(customers.id, existing[0].id))
        .returning();
      return unarchived;
    }
    return existing[0];
  }
  const [created] = await db.insert(customers).values(data).returning();
  return created;
}

// --- No-show risk scoring (v1, rule-based) ---
//
// There's no real booking history yet — only test/demo data — so a
// trained model right now would be fit to synthetic noise, not a real
// pattern, and would look dishonest the moment a client asks how it was
// trained. This is a heuristic, not a classifier: replace it with a real
// model once a client has weeks of genuine booking outcomes to train on.
// Called once, at booking-creation time, from both routes/bookings.ts and
// routes/public.ts (never duplicated) — see the call sites for why it's
// computed once and not recalculated later.
//
// Formula, deliberately simple enough to explain to a client who asks "how
// does this work":
//
//   If the customer has at least one *resolved* past booking (status
//   'completed' or 'no_show' — 'confirmed'/'cancelled' aren't resolved
//   outcomes yet), the score IS their own historical no-show rate:
//
//     score = noShowCount / (noShowCount + completedCount)
//
//   Past behavior is the strongest, most defensible signal available, so
//   it fully determines the score whenever it exists — it is not blended
//   with the weaker fallback signals below.
//
//   Otherwise (a genuine first-time booking, no resolved history), the
//   score is a low, capped baseline built from two documented
//   assumptions — neither an established fact, just a reasonable prior:
//
//     - lead time: booked same-day (<24h notice) assumed higher risk than
//       booked further ahead. Assumption: less notice correlates with a
//       more casual/impulsive plan, which is more likely to fall through.
//     - contact completeness: a customer with only an email on file (no
//       phone) assumed slightly harder to reach/remind than one with both.
//
//     score = min(0.15 + leadTimeRisk + contactRisk, 0.35)
//       leadTimeRisk: 0.15 if <24h notice, 0.05 if <72h, else 0
//       contactRisk: 0.05 if no phone on file, else 0
//
//   Capped at 0.35 deliberately — this path only ever reflects weak
//   priors, never actual evidence of risk, so it must never reach the
//   "High" bucket the dashboard uses for real historical risk.
export async function computeNoShowRisk(customerId: number, startTime: Date): Promise<number> {
  const resolved = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(and(eq(bookings.customerId, customerId), inArray(bookings.status, ["completed", "no_show"])));

  if (resolved.length > 0) {
    const noShowCount = resolved.filter((b) => b.status === "no_show").length;
    return noShowCount / resolved.length;
  }

  const [customer] = await db.select({ phone: customers.phone }).from(customers).where(eq(customers.id, customerId)).limit(1);

  const leadTimeHours = (startTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const leadTimeRisk = leadTimeHours < 24 ? 0.15 : leadTimeHours < 72 ? 0.05 : 0;
  const contactRisk = customer?.phone ? 0 : 0.05;

  return Math.min(0.15 + leadTimeRisk + contactRisk, 0.35);
}
