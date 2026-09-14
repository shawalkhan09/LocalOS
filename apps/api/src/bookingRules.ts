import type { ClientConfig } from "@localos/config-schema";
import { classBookings, customers, db, type Customer } from "@localos/db";
import { and, eq, ne, sql } from "drizzle-orm";
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

export function findService(config: ClientConfig, serviceId: string): ClientConfig["services"][number] {
  const service = config.services.find((s) => s.id === serviceId);
  if (!service) {
    throw new ApiError(400, `unknown serviceId "${serviceId}"`);
  }
  return service;
}

export function findGymClass(config: ClientConfig, classId: string): ClientConfig["classes"][number] {
  const gymClass = config.classes.find((c) => c.id === classId);
  if (!gymClass) {
    throw new ApiError(400, `unknown classId "${classId}"`);
  }
  return gymClass;
}

export function assertStaffQualified(
  config: ClientConfig,
  service: ClientConfig["services"][number],
  staffId: string | undefined,
): void {
  if (staffId !== undefined && !config.staff.some((s) => s.id === staffId)) {
    throw new ApiError(400, `unknown staffId "${staffId}"`);
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
    return existing[0];
  }
  const [created] = await db.insert(customers).values(data).returning();
  return created;
}
