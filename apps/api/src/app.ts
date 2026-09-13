import express, { type ErrorRequestHandler } from "express";
import { ApiError } from "./errors.js";
import { availabilityRouter } from "./routes/availability.js";
import { bookingsRouter } from "./routes/bookings.js";
import { catalogRouter } from "./routes/catalog.js";
import { classBookingsRouter } from "./routes/classBookings.js";
import { customersRouter } from "./routes/customers.js";
import { membershipsRouter } from "./routes/memberships.js";

type PgError = { code: string; detail?: string };

function isPgError(value: unknown): value is PgError {
  return typeof value === "object" && value !== null && "code" in value;
}

// drizzle-orm wraps the raw postgres.js error in a DrizzleQueryError before
// throwing it, so the real PostgresError (with `.code`/`.detail`) lives one
// level deeper, at `err.cause` — not on `err` itself. Check both.
function findPgError(err: unknown): PgError | undefined {
  if (isPgError(err)) {
    return err;
  }
  if (err instanceof Error && isPgError(err.cause)) {
    return err.cause;
  }
  return undefined;
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const pgError = findPgError(err);
  if (pgError?.code === "23505") {
    res.status(409).json({ error: `duplicate: ${pgError.detail ?? "constraint violated"}` });
    return;
  }
  if (pgError?.code === "23503") {
    res.status(400).json({ error: `referenced row does not exist: ${pgError.detail ?? ""}` });
    return;
  }
  if (pgError?.code === "23P01") {
    res.status(409).json({ error: `conflicting booking: ${pgError.detail ?? "overlaps an existing booking"}` });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal server error" });
};

export function createApp() {
  const app = express();
  app.use(express.json());

  // apps/web calls this API cross-origin from the browser. No auth or
  // cookies exist yet (same accepted gap as the rest of the API), so a
  // permissive origin is fine for now rather than a dependency for it.
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(catalogRouter);
  app.use(customersRouter);
  app.use(availabilityRouter);
  app.use(bookingsRouter);
  app.use(classBookingsRouter);
  app.use(membershipsRouter);

  app.use(errorHandler);

  return app;
}
