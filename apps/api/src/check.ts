import assert from "node:assert";
import { createApp } from "./app.js";
import { clientConfig } from "./config.js";
import {
  CreateBookingSchema,
  CreateClassBookingSchema,
  CreateCustomerSchema,
  CreateMembershipSchema,
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

server.close();
