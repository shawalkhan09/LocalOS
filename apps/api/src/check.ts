import assert from "node:assert";
import { db } from "@localos/db";
import { createApp } from "./app.js";
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

server.close();

// GET /catalog now queries Postgres (see routes/catalog.ts), so this
// process holds an open connection pool by the time it gets here — without
// closing it explicitly, node has no reason to exit and this script would
// hang forever instead of completing.
await db.$client.end();
