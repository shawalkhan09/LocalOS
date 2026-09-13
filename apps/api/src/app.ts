import express, { type ErrorRequestHandler } from "express";
import { ApiError } from "./errors.js";
import { bookingsRouter } from "./routes/bookings.js";
import { catalogRouter } from "./routes/catalog.js";
import { classBookingsRouter } from "./routes/classBookings.js";
import { customersRouter } from "./routes/customers.js";
import { membershipsRouter } from "./routes/memberships.js";

function isPgError(err: unknown): err is { code: string; detail?: string } {
  return typeof err === "object" && err !== null && "code" in err;
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (isPgError(err) && err.code === "23505") {
    res.status(409).json({ error: `duplicate: ${err.detail ?? "constraint violated"}` });
    return;
  }
  if (isPgError(err) && err.code === "23503") {
    res.status(400).json({ error: `referenced row does not exist: ${err.detail ?? ""}` });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal server error" });
};

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(catalogRouter);
  app.use(customersRouter);
  app.use(bookingsRouter);
  app.use(classBookingsRouter);
  app.use(membershipsRouter);

  app.use(errorHandler);

  return app;
}
