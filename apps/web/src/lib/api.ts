import type { ClientConfig } from "@localos/config-schema";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
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
