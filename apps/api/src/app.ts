import express, { type ErrorRequestHandler } from "express";
import { requireAuth } from "./auth/middleware.js";
import { ApiError } from "./errors.js";
import { authRouter } from "./routes/auth.js";
import { availabilityRouter } from "./routes/availability.js";
import { bookingsRouter } from "./routes/bookings.js";
import { catalogRouter } from "./routes/catalog.js";
import { classBookingsRouter } from "./routes/classBookings.js";
import { customersRouter } from "./routes/customers.js";
import { membershipsRouter } from "./routes/memberships.js";
import { publicRouter } from "./routes/public.js";
import { staffRouter } from "./routes/staff.js";
import { usersRouter } from "./routes/users.js";

const CLIENT_HEADER_NAME = "x-localos-client";
const CLIENT_HEADER_VALUE = "web";

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
  // Trust the first hop's X-Forwarded-For (typical single-reverse-proxy
  // deployment) so req.ip reflects the real client for rate limiting,
  // rather than the proxy's own address.
  app.set("trust proxy", 1);
  app.use(express.json());

  // Cookies are now in play (session auth), so the origin can no longer be
  // a wildcard — browsers refuse to combine "*" with credentialed
  // requests anyway. ALLOWED_ORIGIN must be the exact frontend origin.
  const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "http://localhost:3001";
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", allowedOrigin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", `Content-Type, ${CLIENT_HEADER_NAME}`);
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // CSRF mitigation: SameSite=None (required for the cross-origin session
  // cookie) provides no CSRF protection on its own — a form on any other
  // site could still submit a cross-site POST with the cookie attached.
  // Requiring this custom header forces the browser to send a CORS
  // preflight first, which only succeeds from the allowed origin above.
  // Not a full CSRF token system, but adequate for this scale. Applied
  // uniformly to every non-GET route, including POST /public/bookings and
  // POST /public/class-bookings — there's no session cookie to protect on
  // those, but the header still forces the same CORS preflight, so it's
  // kept for consistency rather than carving out an exception.
  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      next();
      return;
    }
    if (req.header(CLIENT_HEADER_NAME) !== CLIENT_HEADER_VALUE) {
      res.status(403).json({ error: `missing or invalid ${CLIENT_HEADER_NAME} header` });
      return;
    }
    next();
  });

  app.use(requireAuth);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(authRouter);
  app.use(catalogRouter);
  app.use(customersRouter);
  app.use(availabilityRouter);
  app.use(bookingsRouter);
  app.use(classBookingsRouter);
  app.use(membershipsRouter);
  app.use(publicRouter);
  app.use(usersRouter);
  app.use(staffRouter);

  app.use(errorHandler);

  return app;
}
