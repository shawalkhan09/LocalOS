"use client";

import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import {
  ApiRequestError,
  type Booking,
  type ClassBooking,
  type Customer,
  getBookings,
  getCatalog,
  getClassBookings,
  getCustomers,
} from "@/lib/api";
import { formatDateInTimezone, formatTimeInTimezone, todayInTimezone } from "@/lib/time";
import tableStyles from "@/components/DataTable.module.css";
import styles from "./page.module.css";

// No auth gate yet — same accepted, documented gap as the rest of the API
// (see apps/api/src/app.ts and routes). Anyone who can reach this URL sees
// the full schedule; that's fine for a single front-desk device today, not
// for a public deployment.

export default function TodayPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [classBookings, setClassBookings] = useState<ClassBooking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const catalog = await getCatalog();
        const today = todayInTimezone(catalog.business.timezone);
        const [bookingsRes, classBookingsRes, customersRes] = await Promise.all([
          getBookings(today),
          getClassBookings(today),
          getCustomers(),
        ]);
        if (cancelled) {
          return;
        }
        setConfig(catalog);
        setBookings(bookingsRes);
        setClassBookings(classBookingsRes);
        setCustomers(customersRes);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : "Could not load today's schedule.");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div>
        <h1 className={styles.heading}>Today</h1>
        <p className={`${styles.error} ${styles.section}`}>{error}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div>
        <h1 className={styles.heading}>Today</h1>
      </div>
    );
  }

  const timezone = config.business.timezone;
  const today = todayInTimezone(timezone);
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const serviceById = new Map(config.services.map((s) => [s.id, s]));
  const staffById = new Map(config.staff.map((s) => [s.id, s]));
  const classById = new Map(config.classes.map((c) => [c.id, c]));

  const classGroups = new Map<string, number>();
  for (const cb of classBookings) {
    if (cb.status === "cancelled") {
      continue;
    }
    classGroups.set(cb.classId, (classGroups.get(cb.classId) ?? 0) + 1);
  }

  const sortedBookings = [...bookings].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div>
      <h1 className={styles.heading}>Today</h1>
      <p className={styles.subheading}>{formatDateInTimezone(today, timezone)}</p>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Bookings</h2>
        <div className={styles.panel}>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Customer</th>
                <th>Service</th>
                <th>Staff</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className={tableStyles.empty}>
                    No bookings today.
                  </td>
                </tr>
              ) : (
                sortedBookings.map((b) => (
                  <tr key={b.id}>
                    <td>{formatTimeInTimezone(b.startTime, timezone)}</td>
                    <td>{customerById.get(b.customerId)?.name ?? `Customer #${b.customerId}`}</td>
                    <td>{serviceById.get(b.serviceId)?.name ?? b.serviceId}</td>
                    <td>{b.staffId ? (staffById.get(b.staffId)?.name ?? b.staffId) : "Unassigned"}</td>
                    <td>{b.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Classes</h2>
        <div className={styles.panel}>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Class</th>
                <th>Filled</th>
              </tr>
            </thead>
            <tbody>
              {classGroups.size === 0 ? (
                <tr>
                  <td colSpan={2} className={tableStyles.empty}>
                    No class bookings today.
                  </td>
                </tr>
              ) : (
                [...classGroups.entries()].map(([classId, count]) => {
                  const gymClass = classById.get(classId);
                  const capacity = gymClass?.capacity ?? count;
                  const isFull = count >= capacity;
                  return (
                    <tr key={classId}>
                      <td>{gymClass?.name ?? classId}</td>
                      <td>
                        <span className={`${styles.capacity} ${isFull ? styles.capacityFull : ""}`}>
                          {count}/{capacity}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
