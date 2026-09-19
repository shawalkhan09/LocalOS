import assert from "node:assert";
import { DateTime } from "luxon";
import { db } from "@localos/db";
import { createApp } from "./app.js";
import { assertBookableSessionTime } from "./bookingWindow.js";
import { clientConfig } from "./config.js";
import {
  CreateBookingSchema,
  CreateClassBookingSchema,
  CreateCustomerSchema,
  CreateMembershipSchema,
  CreateStaffSchema,
  CreateTrainerProfileSchema,
  CreateUserSchema,
  PublicCreateBookingSchema,
  UpdateStaffSchema,
  UpdateTrainerProfileSchema,
  UpdateUserSchema,
} from "./validation.js";

// Request validation: must reject bad payloads before they ever reach the DB.
assert(!CreateCustomerSchema.safeParse({ name: "Alex" }).success, "customer needs email or phone");
assert(
  CreateCustomerSchema.safeParse({ name: "Alex", email: "alex@example.com" }).success,
  "customer with email should be valid",
);
assert(
  !CreateBookingSchema.safeParse({
    customerId: 1,
    serviceId: "svc-x",
    startTime: "2026-01-01T10:00:00Z",
    endTime: "2026-01-01T09:00:00Z",
  }).success,
  "booking endTime must be after startTime",
);
assert(
  !CreateClassBookingSchema.safeParse({
    customerId: 1,
    classId: "class-x",
    occurrenceDate: "not-a-date",
  }).success,
  "classBooking occurrenceDate must be YYYY-MM-DD",
);
assert(
  CreateMembershipSchema.safeParse({ customerId: 1, planId: "plan-x", startDate: "2026-01-01" })
    .success,
  "membership with just the required fields should be valid",
);
assert(
  !PublicCreateBookingSchema.safeParse({
    customerName: "Jamie",
    customerPhone: "555-0100",
    serviceId: "svc-x",
    startTime: "2026-01-01T10:00:00Z",
    endTime: "2026-01-01T11:00:00Z",
  }).success,
  "public booking requires customerEmail even though phone is present",
);
assert(
  !CreateUserSchema.safeParse({ email: "staff@example.com", password: "short" }).success,
  "user password must be at least 8 characters",
);
assert(
  CreateUserSchema.safeParse({ email: "staff@example.com", password: "longenough" }).success,
  "user with a valid email and long-enough password should be valid",
);
assert(
  UpdateUserSchema.safeParse({ status: "deactivated" }).success,
  "updating just status should be valid",
);
assert(
  UpdateUserSchema.safeParse({ staffId: null }).success,
  "an explicit null staffId (unlink) should be valid",
);
assert(
  UpdateUserSchema.safeParse({ email: "new@example.com" }).success,
  "an owner correcting an account's email should be valid",
);
assert(
  !UpdateUserSchema.safeParse({ email: "not-an-email" }).success,
  "a malformed email should be rejected",
);
assert(
  !UpdateUserSchema.safeParse({ role: "owner" }).success,
  "changing role is not supported this round and must be rejected, not silently ignored",
);
assert(!UpdateUserSchema.safeParse({}).success, "an update with no fields at all should be rejected");
assert(
  CreateStaffSchema.safeParse({ name: "Jordan Ramirez", role: "Front Desk" }).success,
  "staff with just the required fields should be valid",
);
assert(!CreateStaffSchema.safeParse({ role: "Front Desk" }).success, "staff name is required");
assert(UpdateStaffSchema.safeParse({ role: "Studio Manager" }).success, "updating just role should be valid");
assert(!UpdateStaffSchema.safeParse({}).success, "an update with no fields at all should be rejected");
assert(
  !UpdateStaffSchema.safeParse({ id: "staff-new-id" }).success,
  "changing id is not supported and must be rejected, not silently ignored",
);
assert(
  CreateTrainerProfileSchema.safeParse({ specialties: ["HIIT"], certifications: [] }).success,
  "trainer profile with specialties/certifications arrays should be valid",
);
assert(
  !CreateTrainerProfileSchema.safeParse({ specialties: ["HIIT"] }).success,
  "trainer profile requires certifications even if empty",
);
assert(
  UpdateTrainerProfileSchema.safeParse({ bio: "Updated bio." }).success,
  "updating just bio should be valid",
);
assert(
  !UpdateTrainerProfileSchema.safeParse({ staffId: "staff-someone-else" }).success,
  "reassigning staffId is not supported and must be rejected, not silently ignored",
);
console.log("OK: request validation rejects and accepts the expected shapes");

// Booking time validation: assertBookableSessionTime must enforce all four rules in order.
const service60min = clientConfig.services.find((s) => s.durationMinutes === 60)!;
const fixedNow = DateTime.fromISO("2026-09-21T10:00:00", { zone: clientConfig.business.timezone }); // Monday

// Rule 1: past start rejected
let pastStartFailed = false;
try {
  assertBookableSessionTime({
    service: service60min,
    startTime: fixedNow.minus({ hours: 1 }),
    endTime: fixedNow.plus({ minutes: 0 }),
    now: fixedNow,
  });
} catch (e) {
  pastStartFailed = e instanceof Error && e.message.includes("already passed");
}
assert(pastStartFailed, "should reject past start with 'already passed' message");

// Rule 2: start beyond window rejected
let beyondWindowFailed = false;
try {
  const beyondWindow = fixedNow.plus({ days: clientConfig.booking.advanceBookingDays + 1 });
  assertBookableSessionTime({
    service: service60min,
    startTime: beyondWindow.set({ hour: 10, minute: 0 }),
    endTime: beyondWindow.set({ hour: 11, minute: 0 }),
    now: fixedNow,
  });
} catch (e) {
  beyondWindowFailed = e instanceof Error && e.message.includes("too far ahead");
}
assert(beyondWindowFailed, "should reject beyond window with 'too far ahead' message");

// Rule 2b: last allowed day accepted (today + 14 days)
const lastAllowed = fixedNow.plus({ days: clientConfig.booking.advanceBookingDays }).set({
  hour: 10,
  minute: 0,
});
assertBookableSessionTime({
  service: service60min,
  startTime: lastAllowed,
  endTime: lastAllowed.plus({ minutes: 60 }),
  now: fixedNow,
});

// Rule 3: closed weekday rejected (Sunday has no entry)
let closedDayFailed = false;
try {
  const sunday = fixedNow.plus({ days: 6 }); // Next Sunday
  assertBookableSessionTime({
    service: service60min,
    startTime: sunday.set({ hour: 10, minute: 0 }),
    endTime: sunday.set({ hour: 11, minute: 0 }),
    now: fixedNow,
  });
} catch (e) {
  closedDayFailed = e instanceof Error && e.message.includes("closed");
}
assert(closedDayFailed, "should reject closed day (Sunday) with 'closed' message");

// Rule 3b: before open rejected
let beforeOpenFailed = false;
try {
  const wednesday = fixedNow.plus({ days: 2 }); // Wednesday
  assertBookableSessionTime({
    service: service60min,
    startTime: wednesday.set({ hour: 4, minute: 0 }),
    endTime: wednesday.set({ hour: 5, minute: 0 }),
    now: fixedNow,
  });
} catch (e) {
  beforeOpenFailed = e instanceof Error && e.message.includes("closed");
}
assert(beforeOpenFailed, "should reject before open with 'closed' message");

// Rule 3c: after close rejected
let afterCloseFailed = false;
try {
  const tuesday = fixedNow.plus({ days: 1 }); // Tuesday closes at 21:00
  assertBookableSessionTime({
    service: service60min,
    startTime: tuesday.set({ hour: 20, minute: 30 }),
    endTime: tuesday.set({ hour: 21, minute: 30 }), // Ends after close
    now: fixedNow,
  });
} catch (e) {
  afterCloseFailed = e instanceof Error && e.message.includes("closed");
}
assert(afterCloseFailed, "should reject after close with 'closed' message");

// Rule 4: wrong duration rejected
let wrongDurationFailed = false;
try {
  const wednesday = fixedNow.plus({ days: 2 }); // Wednesday
  assertBookableSessionTime({
    service: service60min,
    startTime: wednesday.set({ hour: 10, minute: 0 }),
    endTime: wednesday.set({ hour: 10, minute: 45 }), // 45 min, not 60
    now: fixedNow,
  });
} catch (e) {
  wrongDurationFailed = e instanceof Error && e.message.includes("doesn't match");
}
assert(wrongDurationFailed, "should reject wrong duration with 'doesn't match' message");

// Valid future slot accepted
const wednesday = fixedNow.plus({ days: 2 }); // Wednesday
assertBookableSessionTime({
  service: service60min,
  startTime: wednesday.set({ hour: 10, minute: 0 }),
  endTime: wednesday.set({ hour: 11, minute: 0 }),
  now: fixedNow,
});

console.log("OK: booking time validation enforces all rules in order");

// HTTP layer: boot the app on an ephemeral port and exercise it. Catalog
// now queries Postgres too (staff/trainers are database-backed — see
// routes/catalog.ts), so unlike the write routes below, this check does
// need a reachable, migrated DATABASE_URL to pass.
const app = createApp();
const server = app.listen(0);
await new Promise((resolve) => server.once("listening", resolve));
const address = server.address();
if (address === null || typeof address === "string") {
  throw new Error("expected a network address");
}
const baseUrl = `http://127.0.0.1:${address.port}`;

const health = await fetch(`${baseUrl}/health`).then((r) => r.json());
assert.deepStrictEqual(health, { ok: true });

const catalog = await fetch(`${baseUrl}/catalog`).then((r) => r.json());
assert.strictEqual(catalog.business.name, clientConfig.business.name);
assert.strictEqual(catalog.services.length, clientConfig.services.length);
assert(Array.isArray(catalog.staff) && catalog.staff.length > 0, "catalog should include staff from the database");
assert(
  Array.isArray(catalog.trainers) && catalog.trainers.length > 0,
  "catalog should include trainers from the database",
);
console.log("OK: /health and /catalog serve the loaded config plus database-backed staff/trainers");

// Auth boundary: a protected route must 401 without a session, and this
// doesn't need a live DB — no cookie means requireAuth rejects before ever
// querying the sessions table.
const unauthed = await fetch(`${baseUrl}/customers`);
assert.strictEqual(unauthed.status, 401);
// /users and /staff are both owner-only (requireOwner), but that check
// never even runs without a session first — requireAuth rejects with 401
// before the request ever reaches requireOwner, same as any other
// protected route.
const unauthedUsers = await fetch(`${baseUrl}/users`);
assert.strictEqual(unauthedUsers.status, 401);
const unauthedStaff = await fetch(`${baseUrl}/staff`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-LocalOS-Client": "web" },
  body: "{}",
});
assert.strictEqual(unauthedStaff.status, 401);
const unauthedArchive = await fetch(`${baseUrl}/customers/1/archive`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-LocalOS-Client": "web" },
});
assert.strictEqual(unauthedArchive.status, 401, "unauthenticated customer archive must be rejected with 401");

const missingCsrf = await fetch(`${baseUrl}/customers/1/archive`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
});
assert.strictEqual(missingCsrf.status, 403, "request without CSRF header must be rejected with 403");

console.log("OK: a protected route rejects requests with no session and missing CSRF header");

// Public booking routes must NOT require a session — sent with a
// deliberately empty body (no DB needed), so a non-401 status proves the
// request passed the auth-exemption check and reached the route's own
// (400) validation, rather than being rejected for having no cookie.
const publicBookingAttempt = await fetch(`${baseUrl}/public/bookings`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-LocalOS-Client": "web" },
  body: "{}",
});
assert.notStrictEqual(publicBookingAttempt.status, 401);
const publicClassBookingAttempt = await fetch(`${baseUrl}/public/class-bookings`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-LocalOS-Client": "web" },
  body: "{}",
});
assert.notStrictEqual(publicClassBookingAttempt.status, 401);
console.log("OK: public booking routes are reachable without a session");

// Session booking validation: past time and outside business hours must be rejected
const timezone = clientConfig.business.timezone;
const now = DateTime.now().setZone(timezone);
const pastTime = now.minus({ hours: 1 });
const futureClosedTime = now.plus({ days: 1 }).set({ hour: 23, minute: 0 });
const futureService = clientConfig.services.find((s) => s.durationMinutes === 60)!;

// Past time rejected
const pastBookingRes = await fetch(`${baseUrl}/public/bookings`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-LocalOS-Client": "web" },
  body: JSON.stringify({
    customerName: "Alice",
    customerEmail: "alice@example.com",
    serviceId: futureService.id,
    startTime: pastTime.toJSDate(),
    endTime: pastTime.plus({ minutes: 60 }).toJSDate(),
  }),
});
assert.strictEqual(pastBookingRes.status, 400, "past booking must return 400");
const pastBookingBody = await pastBookingRes.json();
const pastMsg = String(pastBookingBody.message || pastBookingBody.error || "");
assert(pastMsg.includes("already passed"), `past booking error message: got "${pastMsg}"`);

// Outside business hours rejected
const outsideHoursRes = await fetch(`${baseUrl}/public/bookings`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-LocalOS-Client": "web" },
  body: JSON.stringify({
    customerName: "Bob",
    customerEmail: "bob@example.com",
    serviceId: futureService.id,
    startTime: futureClosedTime.toJSDate(),
    endTime: futureClosedTime.plus({ minutes: 60 }).toJSDate(),
  }),
});
assert.strictEqual(outsideHoursRes.status, 400, "outside hours booking must return 400");
const outsideHoursBody = await outsideHoursRes.json();
const outsideMsg = String(outsideHoursBody.message || outsideHoursBody.error || "");
assert(outsideMsg.includes("closed"), `outside hours error message: got "${outsideMsg}"`);

console.log("OK: session booking validation rejects past times and outside business hours");

server.close();

// GET /catalog now queries Postgres (see routes/catalog.ts), so this
// process holds an open connection pool by the time it gets here — without
// closing it explicitly, node has no reason to exit and this script would
// hang forever instead of completing.
await db.$client.end();
