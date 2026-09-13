import assert from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Schema shape: every client-owned table is keyed by (clientId, id).
for (const [name, table] of [
  ["services", schema.services],
  ["staff", schema.staff],
  ["trainers", schema.trainers],
  ["membershipPlans", schema.membershipPlans],
  ["gymClasses", schema.gymClasses],
] as const) {
  const columns = getTableColumns(table);
  assert(columns.clientId, `${name} must have a clientId column`);
  assert(columns.id, `${name} must have an id column`);
}
assert(getTableColumns(schema.trainers).staffId, "trainers must have a staffId column");
assert(getTableColumns(schema.gymClasses).trainerId, "gymClasses must have a trainerId column");
console.log("OK: schema exposes the expected client-scoped tables and columns");

// Migration output: confirm the generated SQL actually encodes the
// cross-references validated at the config layer (staff <- trainers <- classes).
const migrationsDir = path.resolve(__dirname, "../migrations");
const sqlFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
assert(sqlFiles.length > 0, "expected at least one generated migration file");

const sql = sqlFiles.map((f) => readFileSync(path.join(migrationsDir, f), "utf-8")).join("\n");
assert(sql.includes('REFERENCES "public"."staff"'), "expected trainers -> staff FK in migration SQL");
assert(sql.includes('REFERENCES "public"."trainers"'), "expected gym_classes -> trainers FK in migration SQL");
assert(sql.includes('PRIMARY KEY("client_id","id")'), "expected client-scoped composite primary keys");
console.log("OK: generated migration SQL encodes the expected keys and foreign keys");
