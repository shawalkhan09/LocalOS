import type { ClientConfig, StaffMember, Trainer } from "@localos/config-schema";

// Production calls go through the same-origin /api-proxy rewrite (see
// next.config.ts) instead of straight to Render's own domain — that's
// what keeps the session cookie first-party for Safari/Firefox's tracking
// protections, which otherwise block it as third-party (Vercel calling
// Render cross-origin). Local dev is unchanged: no cross-origin concern
// hitting localhost directly, and every prior round's verification already
// depends on NEXT_PUBLIC_API_URL working exactly as it does today.
const API_URL =
  process.env.NODE_ENV === "production" ? "/api-proxy" : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000");

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// redirectOn401 defaults to true: any dashboard data-fetch that gets a 401
// (session expired or invalidated server-side, stale cookie still present
// client-side) sends the user back to /login from this one place, rather
// than every call site duplicating that check. The one call that must NOT
// redirect is login itself, where a 401 means "wrong password," a normal
// error to show on the login page, not a reason to leave it.
async function request<T>(
  path: string,
  init?: RequestInit,
  { redirectOn401 = true }: { redirectOn401?: boolean } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-LocalOS-Client": "web", ...init?.headers },
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 401 && redirectOn401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  if (res.status === 204) {
    return undefined as T;
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}));
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `request failed (${res.status})`;
    throw new ApiRequestError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export type SessionUser = {
  id: number;
  email: string;
  role: "owner" | "staff";
  staffId: string | null;
};

export function login(email: string, password: string): Promise<SessionUser> {
  return request<SessionUser>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    { redirectOn401: false },
  );
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" }, { redirectOn401: false });
}

export function getMe(): Promise<SessionUser> {
  return request<SessionUser>("/auth/me");
}

export function getCatalog(): Promise<ClientConfig> {
  return request<ClientConfig>("/catalog");
}

export type Customer = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
};

export function getCustomers(): Promise<Customer[]> {
  return request<Customer[]>("/customers");
}

export function createCustomer(data: { name: string; email?: string; phone?: string }): Promise<Customer> {
  return request<Customer>("/customers", { method: "POST", body: JSON.stringify(data) });
}

export type Booking = {
  id: number;
  customerId: number;
  serviceId: string;
  staffId: string | null;
  startTime: string;
  endTime: string;
  status: string;
  noShowRiskScore: string | null;
  createdAt: string;
};

export function getBookings(date?: string): Promise<Booking[]> {
  return request<Booking[]>(`/bookings${date ? `?date=${date}` : ""}`);
}

export function createBooking(data: {
  customerId: number;
  serviceId: string;
  staffId?: string;
  startTime: string;
  endTime: string;
}): Promise<Booking> {
  return request<Booking>("/bookings", { method: "POST", body: JSON.stringify(data) });
}

export type ClassBooking = {
  id: number;
  customerId: number;
  classId: string;
  occurrenceDate: string;
  status: string;
  createdAt: string;
};

export function getClassBookings(date?: string): Promise<ClassBooking[]> {
  return request<ClassBooking[]>(`/class-bookings${date ? `?date=${date}` : ""}`);
}

export type AvailabilitySlot = { startTime: string; endTime: string };

export function checkAvailability(params: {
  serviceId: string;
  staffId?: string;
  date: string;
}): Promise<{ date: string; slots: AvailabilitySlot[] }> {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>,
  );
  return request(`/bookings/check-availability?${qs}`);
}

// Public (unauthenticated) booking — no session exists on this path, so
// there's nothing to redirect on 401 for; these never send one anyway
// (see apps/api's PUBLIC_ROUTES allowlist), but redirectOn401: false keeps
// this call site honest about not depending on that.
export function createPublicBooking(data: {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  serviceId: string;
  staffId?: string;
  startTime: string;
  endTime: string;
}): Promise<Booking> {
  return request<Booking>(
    "/public/bookings",
    { method: "POST", body: JSON.stringify(data) },
    { redirectOn401: false },
  );
}

export function createPublicClassBooking(data: {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  classId: string;
  occurrenceDate: string;
}): Promise<ClassBooking> {
  return request<ClassBooking>(
    "/public/class-bookings",
    { method: "POST", body: JSON.stringify(data) },
    { redirectOn401: false },
  );
}

// Owner-only (GET/POST/PATCH /users) — a non-owner gets a 403 from the
// API, not a 401, so the default redirectOn401 behavior is irrelevant
// here and left as-is; /dashboard/team handles the 403 itself (see that
// page).
export type Account = {
  id: number;
  email: string;
  role: "owner" | "staff";
  status: "active" | "deactivated";
  staffId: string | null;
  createdAt: string;
};

export function getUsers(): Promise<Account[]> {
  return request<Account[]>("/users");
}

export function createUser(data: { email: string; password: string; staffId?: string }): Promise<Account> {
  return request<Account>("/users", { method: "POST", body: JSON.stringify(data) });
}

// email, status, and staffId are supported — matches PATCH /users/:id,
// which rejects (400) any other key (role) rather than silently ignoring
// it. staffId: null explicitly unlinks; omit any key entirely to leave it
// unchanged.
export function updateUser(
  id: number,
  data: { email?: string; status?: "active" | "deactivated"; staffId?: string | null },
): Promise<Account> {
  return request<Account>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

// Owner-only (POST/PATCH /staff, POST/PATCH /staff/:id/trainer-profile) —
// same 403-not-401 reasoning as the users endpoints above. Reads still go
// through getCatalog() — these are write-only, there's no separate
// GET /staff.
export function createStaff(data: {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  bio?: string;
}): Promise<StaffMember> {
  return request<StaffMember>("/staff", { method: "POST", body: JSON.stringify(data) });
}

// All fields optional and .strict() on the API side — matches
// PATCH /staff/:id, which rejects (400) any unrecognized key.
export function updateStaff(
  id: string,
  data: Partial<{ name: string; role: string; email: string; phone: string; bio: string }>,
): Promise<StaffMember> {
  return request<StaffMember>(`/staff/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

// Create-only — matches POST /staff/:id/trainer-profile, which 409s if a
// profile already exists for this staffId rather than overwriting it.
export function createTrainerProfile(
  staffId: string,
  data: { specialties: string[]; certifications: string[]; bio?: string; photoUrl?: string },
): Promise<Trainer> {
  return request<Trainer>(`/staff/${staffId}/trainer-profile`, { method: "POST", body: JSON.stringify(data) });
}

export function updateTrainerProfile(
  staffId: string,
  data: Partial<{ specialties: string[]; certifications: string[]; bio: string; photoUrl: string }>,
): Promise<Trainer> {
  return request<Trainer>(`/staff/${staffId}/trainer-profile`, { method: "PATCH", body: JSON.stringify(data) });
}
