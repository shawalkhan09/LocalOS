import assert from "node:assert";
import { createApp } from "./app.js";
import { clientConfig } from "./config.js";
import {
  CreateBookingSchema,
  CreateClassBookingSchema,
  CreateCustomerSchema,
  CreateMembershipSchema,
  CreateUserSchema,
  PublicCreateBookingSchema,
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
console.log("OK: request validation rejects and accepts the expected shapes");

// HTTP layer: boot the app on an ephemeral port and exercise the routes that
// don't need a live DB. Catalog is read-only from the already-validated
// config; write routes need Postgres and aren't covered by this check.
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
console.log("OK: /health and /catalog serve the loaded config");

// Auth boundary: a protected route must 401 without a session, and this
// doesn't need a live DB — no cookie means requireAuth rejects before ever
// querying the sessions table.
const unauthed = await fetch(`${baseUrl}/customers`);
assert.strictEqual(unauthed.status, 401);
// /users is owner-only (requireOwner), but that check never even runs
// without a session first — requireAuth rejects with 401 before the
// request ever reaches requireOwner, same as any other protected route.
const unauthedUsers = await fetch(`${baseUrl}/users`);
assert.strictEqual(unauthedUsers.status, 401);
console.log("OK: a protected route rejects requests with no session");

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
