import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// postgres.js connects lazily on first query, so this is safe to import even
// when no DB is reachable yet (e.g. running the API's non-DB routes locally).
const connectionString = process.env.DATABASE_URL ?? "postgres://localhost:5432/localos";

export const db = drizzle(postgres(connectionString), { schema });
