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
  sql.includes(
    'CONSTRAINT "class_bookings_customer_id_class_id_occurrence_date_unique" UNIQUE("customer_id","class_id","occurrence_date")',
  ),
  "expected unique constraint on class_bookings(customer_id, class_id, occurrence_date)",
);
console.log("OK: generated migration SQL matches the single-tenant shape");
