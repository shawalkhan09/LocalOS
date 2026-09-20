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
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Single-tenant: one deployment serves exactly one client. Most catalog
// data (services, classes, membership plans) lives in that client's
// config.json, loaded via @localos/config-schema at runtime — it is not
// duplicated here. Staff and trainer profiles are the exception: unlike
// the rest of the catalog, a roster changes on its own schedule (hires,
// departures, contact info), not at deploy time, so they're real tables
// below rather than config.json entries.

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => ({
    emailOrPhoneRequired: check(
      "customers_email_or_phone_required",
      sql`${table.email} IS NOT NULL OR ${table.phone} IS NOT NULL`,
    ),
  }),
);

export type Customer = typeof customers.$inferSelect;

// Staff used to live entirely in config.json (a deploy-time file) — see
// the module comment above for why that stopped being the right home for
// it. id stays a plain string (e.g. "staff-priya"), preserved unchanged
// from config.json by the one-time migration in
// scripts/migrate-staff-from-config.ts, so every existing reference to a
// staffId elsewhere (bookings, users, trainer_profiles below) needed no
// changes of its own.
export const staff = pgTable("staff", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  email: text("email"),
  phone: text("phone"),
  bio: text("bio"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Staff = typeof staff.$inferSelect;

// A staff member with no row here is not a bookable trainer — that
// absence IS the signal. Deliberately not paired with an `isTrainer`
// boolean on `staff`, which could drift from this table's actual contents
// (e.g. a row deleted here but a flag left true over there). id stays
// "trainer-priya"-style, preserved unchanged by the same migration script
// as `staff` above. staffId is a real FK (not optional — a trainer
// profile only exists as an extension of a staff record).
export const trainerProfiles = pgTable("trainer_profiles", {
  id: text("id").primaryKey(),
  staffId: text("staff_id")
    .notNull()
    .references(() => staff.id),
  specialties: text("specialties").array(),
  certifications: text("certifications").array(),
  photoUrl: text("photo_url"),
  bio: text("bio"),
});

export type TrainerProfile = typeof trainerProfiles.$inferSelect;

export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

// serviceId is a config.json id (e.g. "svc-personal-training") — the
// service catalog stays config-driven this round, so this is intentionally
// plain text, validated against the loaded config at the API layer. Do not
// "fix" this into a FK against a table that doesn't exist.
//
// staffId IS a real FK now, against the `staff` table above: staff used to
// live in config.json (a deploy-time file, not a database), so a DB-level
// FK was never possible before. Now that staff has moved into the database
// itself, the same guarantee Postgres already gave bookings->customers can
// finally cover bookings->staff too. serviceId isn't getting the same
// upgrade because *it* is staying in config.json — this isn't an
// inconsistency, it's the same rule applied to two different states of
// data. Nullable: a booking isn't required to be scoped to a specific
// staff member.
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
  staffId: text("staff_id").references(() => staff.id),
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

// Deactivated, not deleted: a hard delete would orphan any booking/audit
// history tied to the account, and there'd be no way back from an owner's
// mistake. See apps/api/src/routes/users.ts (PATCH /users/:id) for how
// status changes are made — deactivating also deletes the account's
// sessions rows immediately, so this alone isn't the enforcement point;
// requireAuth checking status on every request is (apps/api/src/auth/
// session.ts).
export const userStatusEnum = pgEnum("user_status", ["active", "deactivated"]);

// staffId is a real FK now, against the `staff` table above — same
// upgrade, and the same reasoning, as bookings.staffId. Optional: an owner
// account need not map to a staff row.
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull(),
    status: userStatusEnum("status").notNull().default("active"),
    staffId: text("staff_id").references(() => staff.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // A staff member can be linked to at most one login account.
    // Partial (WHERE staff_id IS NOT NULL) so any number of accounts
    // can stay unlinked (staffId: null) without colliding with each
    // other — only an actual double-link is rejected.
    oneAccountPerStaffMember: uniqueIndex("users_staff_id_unique")
      .on(table.staffId)
      .where(sql`${table.staffId} IS NOT NULL`),
  }),
);

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
