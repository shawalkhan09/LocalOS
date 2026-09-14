import assert from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Schema shape: single-tenant transactional tables, no client scoping.
const tables = {
  customers: schema.customers,
  bookings: schema.bookings,
  classBookings: schema.classBookings,
  memberships: schema.memberships,
  users: schema.users,
  sessions: schema.sessions,
  staff: schema.staff,
  trainerProfiles: schema.trainerProfiles,
} as const;

for (const [name, table] of Object.entries(tables)) {
  const columns = getTableColumns(table);
  assert(columns.id, `${name} must have an id column`);
  assert(!("clientId" in columns), `${name} must not have a clientId column`);
}
assert(getTableColumns(schema.bookings).customerId, "bookings must have a customerId column");
assert(getTableColumns(schema.bookings).serviceId, "bookings must have a serviceId column");
assert(
  getTableColumns(schema.classBookings).occurrenceDate,
  "classBookings must have an occurrenceDate column",
);
assert(getTableColumns(schema.memberships).planId, "memberships must have a planId column");
assert(getTableColumns(schema.users).email, "users must have an email column");
assert(getTableColumns(schema.users).passwordHash, "users must have a passwordHash column");
assert(getTableColumns(schema.users).status, "users must have a status column");
assert(getTableColumns(schema.sessions).userId, "sessions must have a userId column");
assert(getTableColumns(schema.sessions).expiresAt, "sessions must have an expiresAt column");
assert(getTableColumns(schema.staff).name, "staff must have a name column");
assert(getTableColumns(schema.staff).role, "staff must have a role column");
assert(getTableColumns(schema.trainerProfiles).staffId, "trainerProfiles must have a staffId column");
assert(
  getTableColumns(schema.trainerProfiles).specialties,
  "trainerProfiles must have a specialties column",
);
console.log("OK: schema exposes the expected single-tenant tables and columns");

// Migration output: confirm the catalog tables are really gone and that
// serviceId/classId/planId were NOT turned into foreign keys (those are
// config.json ids, validated at the API layer, not by Postgres).
const migrationsDir = path.resolve(__dirname, "../migrations");
const sqlFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
assert(sqlFiles.length > 0, "expected at least one generated migration file");

const sql = sqlFiles.map((f) => readFileSync(path.join(migrationsDir, f), "utf-8")).join("\n");
assert(!/CREATE TABLE "clients"/.test(sql), "clients table should be gone");
assert(
  !/FOREIGN KEY \("service_id"\)/.test(sql),
  "service_id must not be a foreign key",
);
assert(!/FOREIGN KEY \("class_id"\)/.test(sql), "class_id must not be a foreign key");
assert(!/FOREIGN KEY \("plan_id"\)/.test(sql), "plan_id must not be a foreign key");

assert(
  sql.includes('ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk"'),
  "expected bookings -> customers FK in migration SQL",
);
assert(
  sql.includes(
    'ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_customer_id_customers_id_fk"',
  ),
  "expected class_bookings -> customers FK in migration SQL",
);
assert(
  sql.includes(
    'ALTER TABLE "memberships" ADD CONSTRAINT "memberships_customer_id_customers_id_fk"',
  ),
  "expected memberships -> customers FK in migration SQL",
);
assert(
  sql.includes('ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk"'),
  "expected sessions -> users FK in migration SQL",
);
assert(sql.includes('CONSTRAINT "users_email_unique" UNIQUE("email")'), "expected unique email on users");
assert(sql.includes(`"status" "user_status" DEFAULT 'active' NOT NULL`), "expected a not-null status column defaulting to active on users");
assert(
  sql.includes(
    'CONSTRAINT "class_bookings_customer_id_class_id_occurrence_date_unique" UNIQUE("customer_id","class_id","occurrence_date")',
  ),
  "expected unique constraint on class_bookings(customer_id, class_id, occurrence_date)",
);
// Staff moved from config.json into the database this round, so — unlike
// service_id/class_id/plan_id above — staff_id references ARE expected to
// be real foreign keys now. See the comment on `bookings` in schema.ts.
assert(
  sql.includes(
    'ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id")',
  ),
  "expected bookings -> staff FK in migration SQL",
);
assert(
  sql.includes(
    'ALTER TABLE "users" ADD CONSTRAINT "users_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id")',
  ),
  "expected users -> staff FK in migration SQL",
);
assert(
  sql.includes(
    'ALTER TABLE "trainer_profiles" ADD CONSTRAINT "trainer_profiles_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id")',
  ),
  "expected trainer_profiles -> staff FK in migration SQL",
);
console.log("OK: generated migration SQL matches the single-tenant shape");

// Hand-added pieces (not expressible in schema.ts, see the comment on
// `bookings` there): the btree_gist extension and the staff-overlap
// EXCLUDE constraint must both still be present after any regeneration.
assert(sql.includes("CREATE EXTENSION IF NOT EXISTS btree_gist"), "expected btree_gist extension");
assert(
  sql.includes(
    'EXCLUDE USING gist ("staff_id" WITH =, tstzrange("start_time", "end_time") WITH &&) WHERE ("staff_id" IS NOT NULL)',
  ),
  "expected staff-overlap EXCLUDE constraint on bookings",
);
assert(/timestamp with time zone/.test(sql), "expected timestamptz columns, not naive timestamp");
console.log("OK: generated migration SQL includes the hand-added overlap protection");
