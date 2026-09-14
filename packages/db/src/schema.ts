import { sql } from "drizzle-orm";
import {
  check,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// Single-tenant: one deployment serves exactly one client. Catalog data
// (services, staff, trainers, classes, membership plans) lives in that
// client's config.json, loaded via @localos/config-schema at runtime — it
// is not duplicated here. This schema only persists dynamic, per-customer
// runtime data.

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailOrPhoneRequired: check(
      "customers_email_or_phone_required",
      sql`${table.email} IS NOT NULL OR ${table.phone} IS NOT NULL`,
    ),
  }),
);

export type Customer = typeof customers.$inferSelect;

export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

// serviceId/staffId are ids from config.json (e.g. "svc-personal-training"),
// not foreign keys: the catalog they reference lives in config.json, not in
// a DB table. They're validated against the loaded config at the API layer
// in step 3 — do not "fix" this into a FK against a table that doesn't
// exist.
//
// startTime/endTime are timestamptz (withTimezone: true), not plain
// timestamp: they represent unambiguous instants, and availability/conflict
// logic across a business.timezone depends on that. There is also a
// GiST EXCLUDE constraint here — `EXCLUDE USING gist (staff_id WITH =,
// tstzrange(start_time, end_time) WITH &&) WHERE (staff_id IS NOT NULL)` —
// preventing two overlapping bookings for the same staffId at the DB level.
// drizzle-orm's pg-core has no EXCLUDE constraint builder, so it's hand-added
// to the generated migration SQL (see migrations/) instead of expressed
// here; it requires the btree_gist extension, also hand-added there.
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  serviceId: text("service_id").notNull(),
  staffId: text("staff_id"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  status: bookingStatusEnum("status").default("confirmed"),
  noShowRiskScore: numeric("no_show_risk_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const classBookingStatusEnum = pgEnum("class_booking_status", [
  "booked",
  "attended",
  "no_show",
  "cancelled",
]);

// classId is a config.json id, same reasoning as bookings.serviceId above:
// not a FK, validated against the loaded config at the API layer.
export const classBookings = pgTable(
  "class_bookings",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    classId: text("class_id").notNull(),
    occurrenceDate: date("occurrence_date").notNull(),
    status: classBookingStatusEnum("status").default("booked"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    oneBookingPerOccurrence: unique().on(
      table.customerId,
      table.classId,
      table.occurrenceDate,
    ),
  }),
);

export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "paused",
  "cancelled",
]);

// planId is a config.json id, same reasoning as bookings.serviceId above:
// not a FK, validated against the loaded config at the API layer.
export const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  planId: text("plan_id").notNull(),
  status: membershipStatusEnum("status").default("active"),
  startDate: date("start_date").notNull(),
  renewalDate: date("renewal_date"),
  creditsRemaining: integer("credits_remaining"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRoleEnum = pgEnum("user_role", ["owner", "staff"]);

// staffId is a config.json id (the staff array), same reasoning as
// bookings.serviceId above: not a FK, since that catalog lives in
// config.json. It's optional — an owner account need not map to a staff
// row.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  staffId: text("staff_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// id is a random opaque token (see apps/api/src/auth/session.ts), not a
// serial int — a guessable/enumerable session id would defeat the point of
// a session cookie.
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
