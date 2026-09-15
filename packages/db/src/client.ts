import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// postgres.js connects lazily on first query, so this is safe to import even
// when no DB is reachable yet (e.g. running the API's non-DB routes locally).
//
// No explicit `ssl` option here — Neon (production) requires SSL, but its
// connection strings already carry `?sslmode=require`, and postgres.js
// parses `sslmode` out of the connection string itself and sets `ssl`
// accordingly. Verified against a real Neon database, not assumed: a plain
// `postgres(connectionString)` connects fine. Local Postgres (no sslmode
// in the URL) is unaffected either way — don't add a hardcoded `ssl:
// "require"` here, it would break every local round's setup.
const connectionString = process.env.DATABASE_URL ?? "postgres://localhost:5432/localos";

export const db = drizzle(postgres(connectionString), { schema });
