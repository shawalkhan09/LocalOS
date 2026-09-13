import {
  boolean,
  foreignKey,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Every client-owned table is keyed by (clientId, id) rather than a global id:
// catalog ids come from each client's config.json and are only meant to be
// unique within that client, same as the zod validation in @localos/config-schema.

export const weekdayEnum = pgEnum("weekday", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const billingIntervalEnum = pgEnum("billing_interval", [
  "monthly",
  "annual",
  "week",
  "day",
]);

export const clients = pgTable("clients", {
  id: text("id").primaryKey(), // slug, e.g. "gym-demo"
  businessName: text("business_name").notNull(),
  legalName: text("legal_name"),
  timezone: text("timezone").notNull(),
  currency: text("currency").notNull(),
  description: text("description"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  contactWebsite: text("contact_website"),
  addressStreet: text("address_street").notNull(),
  addressCity: text("address_city").notNull(),
  addressState: text("address_state").notNull(),
  addressZip: text("address_zip").notNull(),
  addressCountry: text("address_country").notNull(),
  advanceBookingDays: integer("advance_booking_days").notNull(),
  cancellationWindowHours: integer("cancellation_window_hours").notNull(),
  slotIntervalMinutes: integer("slot_interval_minutes").notNull(),
  requireDeposit: boolean("require_deposit").notNull().default(false),
  depositAmount: numeric("deposit_amount"),
  features: jsonb("features").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const services = pgTable(
  "services",
  {
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    id: text("id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    price: numeric("price").notNull(),
    category: text("category"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.clientId, table.id] }),
  }),
);

export const staff = pgTable(
  "staff",
  {
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    id: text("id").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    email: text("email"),
    phone: text("phone"),
    bio: text("bio"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.clientId, table.id] }),
  }),
);

export const trainers = pgTable(
  "trainers",
  {
    clientId: text("client_id").notNull(),
    id: text("id").notNull(),
    staffId: text("staff_id").notNull(),
    bio: text("bio"),
    specialties: text("specialties").array(),
    certifications: text("certifications").array(),
    photoUrl: text("photo_url"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.clientId, table.id] }),
    staffFk: foreignKey({
      columns: [table.clientId, table.staffId],
      foreignColumns: [staff.clientId, staff.id],
    }),
  }),
);

export const membershipPlans = pgTable(
  "membership_plans",
  {
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    id: text("id").notNull(),
    name: text("name").notNull(),
    price: numeric("price").notNull(),
    billingInterval: billingIntervalEnum("billing_interval").notNull(),
    description: text("description"),
    perks: text("perks").array(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.clientId, table.id] }),
  }),
);

export const gymClasses = pgTable(
  "gym_classes",
  {
    clientId: text("client_id").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    trainerId: text("trainer_id").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    capacity: integer("capacity").notNull(),
    category: text("category"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.clientId, table.id] }),
    trainerFk: foreignKey({
      columns: [table.clientId, table.trainerId],
      foreignColumns: [trainers.clientId, trainers.id],
    }),
  }),
);

// Schedule slots have no natural id in config-schema (just {day, startTime}
// inside classes[].schedule), so this table alone uses a surrogate key.
export const classScheduleSlots = pgTable(
  "class_schedule_slots",
  {
    id: serial("id").primaryKey(),
    clientId: text("client_id").notNull(),
    classId: text("class_id").notNull(),
    day: weekdayEnum("day").notNull(),
    startTime: text("start_time").notNull(), // "HH:MM"
  },
  (table) => ({
    classFk: foreignKey({
      columns: [table.clientId, table.classId],
      foreignColumns: [gymClasses.clientId, gymClasses.id],
    }),
  }),
);
