import { sql } from "drizzle-orm";
import {
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
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

// Services used to live entirely in config.json too — same reasoning as
// `staff` above, and the same cutover pattern: id stays a plain string
// (e.g. "svc-personal-training"), preserved unchanged from config.json by
// the one-time migration in scripts/migrate-services-from-config.ts, so
// every existing reference to a serviceId elsewhere (bookings) needed no
// changes of its own. staffIds mirrors trainerProfiles.specialties: a text
// array rather than a join table, since "which staff can perform this
// service" is service-owned data with no per-row attributes of its own.
export const services = pgTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull(),
  price: numeric("price").notNull(),
  category: text("category"),
  staffIds: text("staff_ids").array(),
});

export type Service = typeof services.$inferSelect;

// Classes used to live entirely in config.json too (gym-vertical-specific,
// see packages/config-schema's gym.ts) — same cutover pattern as services
// above: id stays a plain string (e.g. "class-strength-101"), preserved
// unchanged from config.json by the one-time migration in
// scripts/migrate-classes-from-config.ts. trainerId is not a FK — same
// "runtime-checked, not DB-enforced" reasoning as services.staffIds;
// trainerId is validated against trainer_profiles at the one place classes
// are read (GET /catalog), same as before. schedule is jsonb (an array of
// { day, startTime } slots) rather than a separate table, since a class's
// recurring weekly schedule has no independent identity of its own.
type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export const classes = pgTable("classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  trainerId: text("trainer_id").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  capacity: integer("capacity").notNull(),
  category: text("category"),
  schedule: jsonb("schedule").$type<{ day: Weekday; startTime: string }[]>().notNull(),
});

export type Class = typeof classes.$inferSelect;

// Business hours used to live in config.json too, but unlike
// services/staff/classes it isn't an owner-managed list of arbitrary
// records — it's a bounded 7-day settings object, so `day` (not a
// generated id) is the natural primary key. A day with no row is closed —
// same "no entry = closed" contract base.ts's BusinessHoursSlotSchema
// already documents. day stays `text`, not a pgEnum: same runtime-checked
// reasoning as classes.trainerId, and there's no existing pgEnum
// precedent for weekday elsewhere in this file.
export const businessHours = pgTable("business_hours", {
  day: text("day").$type<Weekday>().primaryKey(),
  openTime: text("open_time").notNull(),
  closeTime: text("close_time").notNull(),
});

export type BusinessHours = typeof businessHours.$inferSelect;

// Business branding/contact used to live in config.json too, but unlike
// businessHours it's not a bounded per-key settings object — it's a single
// row of fields with no natural per-field key, so (like classes.schedule)
// there's no better primary key than a fixed literal. id is always the
// string "default", set once by the cutover script and never changed —
// this table only ever holds that one row. address is jsonb for the same
// reason classes.schedule is: it has no independent identity of its own
// outside this one row. timezone/currency stay in config.json (deploy-time
// infrastructure settings, read synchronously across every date/
// availability calculation) — only branding/contact moved here.
export const businessInfo = pgTable("business_info", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  description: text("description"),
  primaryColor: text("primary_color").notNull(),
  logoUrl: text("logo_url"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  contactWebsite: text("contact_website"),
  address: jsonb("address")
    .$type<{ street: string; city: string; state: string; zip: string; country: string }>()
    .notNull(),
});

export type BusinessInfo = typeof businessInfo.$inferSelect;

export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

// serviceId IS a real FK now, against the `services` table above — the
// same upgrade, and the same reasoning, as staffId below: services used to
// live in config.json (a deploy-time file, not a database), so a DB-level
// FK was never possible before. Now that both catalogs live in the
// database, bookings can finally be guaranteed to reference a real row on
// both sides instead of just one.
//
// staffId is a real FK too, against the `staff` table above: staff used to
// live in config.json (a deploy-time file, not a database), so a DB-level
// FK was never possible before. Now that staff has moved into the database
// itself, the same guarantee Postgres already gave bookings->customers can
// finally cover bookings->staff too. Nullable: a booking isn't required to
// be scoped to a specific staff member.
//
// startTime/endTime are timestamptz (withTimezone: true), not plain
// timestamp: they represent unambiguous instants, and availability/conflict
// logic across a business.timezone depends on that. There is also a
// GiST EXCLUDE constraint here — `EXCLUDE USING gist (staff_id WITH =,
// tstzrange(start_time, end_time) WITH &&) WHERE (staff_id IS NOT NULL AND
// (status IS NULL OR status <> 'cancelled'))` — preventing two overlapping
// bookings for the same staffId at the DB level, except a cancelled booking
// no longer counts as occupying its slot.
// drizzle-orm's pg-core has no EXCLUDE constraint builder, so it's hand-added
// to the generated migration SQL (see migrations/) instead of expressed
// here; it requires the btree_gist extension, also hand-added there.
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
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

// classId IS a real FK now, against the `classes` table above — the same
// upgrade, and the same reasoning, as bookings.serviceId: classes used to
// live in config.json (a deploy-time file, not a database), so a DB-level
// FK was never possible before.
export const classBookings = pgTable(
  "class_bookings",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id),
    occurrenceDate: date("occurrence_date").notNull(),
    status: classBookingStatusEnum("status").default("booked"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Partial (WHERE status IS NULL OR status <> 'cancelled') so a
    // cancelled class booking no longer blocks re-booking the same
    // occurrence — same reasoning as the bookings EXCLUDE constraint above.
    oneBookingPerOccurrence: uniqueIndex("class_bookings_one_active_per_occurrence").on(
      table.customerId,
      table.classId,
      table.occurrenceDate,
    ).where(sql`${table.status} IS NULL OR ${table.status} <> 'cancelled'`),
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
