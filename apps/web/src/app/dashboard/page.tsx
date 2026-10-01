"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import {
  ApiRequestError,
  type Booking,
  type ClassBooking,
  type Customer,
  cancelBooking,
  cancelClassBooking,
  getBookings,
  getCatalog,
  getClassBookings,
  getCustomers,
} from "@/lib/api";
import { formatDateInTimezone, formatTimeInTimezone, todayInTimezone } from "@/lib/time";
import tableStyles from "@/components/DataTable.module.css";
import { Card, Input, PageHeader, SectionTitle, StatusPill } from "@/components";
import buttonStyles from "@/components/Button.module.css";
import type { StatusPillVariant } from "@/components/StatusPill";
import styles from "./page.module.css";

// No auth gate yet — same accepted, documented gap as the rest of the API
// (see apps/api/src/app.ts and routes). Anyone who can reach this URL sees
// the full schedule; that's fine for a single front-desk device today, not
// for a public deployment.

// Same three-bucket thresholds a client could be told plainly: below 0.34
// is Low, 0.34–0.66 is Medium, 0.67 and up is High. Staff see a bucket,
// not a raw decimal — nobody should need to judge 0.34 vs 0.61 at a
// glance. Bucketing is presentation-only and lives here, not in the API;
// the score itself (and its formula) is computed once, at booking-creation
// time, by apps/api/src/bookingRules.ts.
type RiskBucket = "low" | "medium" | "high";

function riskBucket(score: string | null): RiskBucket | null {
  if (score === null) {
    return null;
  }
  const value = Number.parseFloat(score);
  if (Number.isNaN(value)) {
    return null;
  }
  if (value < 0.34) {
    return "low";
  }
  if (value < 0.67) {
    return "medium";
  }
  return "high";
}

const RISK_LABEL: Record<RiskBucket, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
const RISK_VARIANT: Record<RiskBucket, StatusPillVariant> = {
  low: "muted",
  medium: "warning",
  high: "danger",
};

function bookingStatusVariant(status: string): StatusPillVariant {
  if (status === "cancelled") {
    return "danger";
  }
  if (status === "confirmed" || status === "booked") {
    return "success";
  }
  return "muted";
}

// The native date input fires onChange with a partial or empty value while
// a segment is mid-edit (e.g. the day segment cleared with Backspace) — not
// just on a complete date. Only a complete yyyy-mm-dd string is a valid
// selection; anything else is an in-progress edit to ignore, or the whole
// page crashes downstream in formatDateInTimezone (`new Date` on a
// malformed string).
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Which row (if any) is mid two-step cancel — only one at a time, across
// both tables, since they share the same confirm/keep UI pattern.
type ConfirmTarget = { kind: "booking" | "classBooking"; id: number };

export default function TodayPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [classBookings, setClassBookings] = useState<ClassBooking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<{
    kind: ConfirmTarget["kind"];
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCatalog()
      .then((catalog) => {
        if (cancelled) {
          return;
        }
        setConfig(catalog);
        setSelectedDate(todayInTimezone(catalog.business.timezone));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : "Could not load today's schedule.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedDate === null) {
      return;
    }
    let cancelled = false;
    Promise.all([getBookings(selectedDate), getClassBookings(selectedDate), getCustomers("all")])
      .then(([bookingsRes, classBookingsRes, customersRes]) => {
        if (cancelled) {
          return;
        }
        setBookings(bookingsRes);
        setClassBookings(classBookingsRes);
        setCustomers(customersRes);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : "Could not load today's schedule.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  async function reload() {
    if (selectedDate === null) {
      return;
    }
    const [bookingsRes, classBookingsRes] = await Promise.all([
      getBookings(selectedDate),
      getClassBookings(selectedDate),
    ]);
    setBookings(bookingsRes);
    setClassBookings(classBookingsRes);
  }

  async function handleConfirmCancel() {
    if (!confirmTarget) {
      return;
    }
    setCancelling(true);
    try {
      if (confirmTarget.kind === "booking") {
        await cancelBooking(confirmTarget.id);
      } else {
        await cancelClassBooking(confirmTarget.id);
      }
      setCancelError(null);
      setConfirmTarget(null);
      await reload();
    } catch (err) {
      setCancelError({
        kind: confirmTarget.kind,
        message: err instanceof ApiRequestError ? err.message : "Could not cancel this booking.",
      });
    } finally {
      setCancelling(false);
    }
  }

  function handleKeep() {
    setConfirmTarget(null);
    setCancelError(null);
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Today" />
        <p className={`${styles.error} ${styles.section}`}>{error}</p>
      </div>
    );
  }

  if (!config || selectedDate === null) {
    return (
      <div>
        <PageHeader title="Today" />
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
  const isToday = selectedDate === today;

  return (
    <div>
      <PageHeader
        eyebrow={formatDateInTimezone(selectedDate, timezone)}
        title={isToday ? "Today" : formatDateInTimezone(selectedDate, timezone)}
        actions={
          <>
            <label htmlFor="schedule-date" className={styles.dateLabel}>
              Date
            </label>
            <Input
              id="schedule-date"
              type="date"
              className={styles.dateInput}
              value={selectedDate}
              onChange={(e) => {
                if (!ISO_DATE.test(e.target.value)) {
                  return;
                }
                setSelectedDate(e.target.value);
                setConfirmTarget(null);
                setCancelError(null);
              }}
            />
            <Link href="/dashboard/new-booking" className={`${buttonStyles.button} ${buttonStyles.primary}`}>
              New booking
            </Link>
          </>
        }
      />

      <div className={styles.block}>
        <SectionTitle>Bookings</SectionTitle>
        <Card className={`${tableStyles.tableCard} ${styles.tableCard}`}>
          <div className={tableStyles.tableWrap}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Staff</th>
                  <th>Status</th>
                  <th>No-show risk</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={tableStyles.empty}>
                      {isToday ? "No bookings today." : "No bookings on this date."}
                    </td>
                  </tr>
                ) : (
                  sortedBookings.map((b) => {
                    const bucket = riskBucket(b.noShowRiskScore);
                    const isCancelled = b.status === "cancelled";
                    const isConfirming = confirmTarget?.kind === "booking" && confirmTarget.id === b.id;
                    return (
                      <tr key={b.id} className={isCancelled ? styles.mutedRow : ""}>
                        <td>{formatTimeInTimezone(b.startTime, timezone)}</td>
                        <td>{customerById.get(b.customerId)?.name ?? `Customer #${b.customerId}`}</td>
                        <td>{serviceById.get(b.serviceId)?.name ?? b.serviceId}</td>
                        <td>{b.staffId ? (staffById.get(b.staffId)?.name ?? b.staffId) : "Unassigned"}</td>
                        <td>
                          <StatusPill variant={bookingStatusVariant(b.status)}>{b.status}</StatusPill>
                        </td>
                        <td>
                          {bucket && <StatusPill variant={RISK_VARIANT[bucket]}>{RISK_LABEL[bucket]}</StatusPill>}
                        </td>
                        <td>
                          {b.status === "confirmed" &&
                            (isConfirming ? (
                              <div className={styles.confirmActions}>
                                <button
                                  type="button"
                                  className={styles.actionLinkWarn}
                                  onClick={handleConfirmCancel}
                                  disabled={cancelling}
                                >
                                  Confirm cancel
                                </button>
                                <button
                                  type="button"
                                  className={styles.actionLink}
                                  onClick={handleKeep}
                                  disabled={cancelling}
                                >
                                  Keep
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className={styles.actionLinkWarn}
                                onClick={() =>
                                  setConfirmTarget({
                                    kind: "booking",
                                    id: b.id,
                                  })
                                }
                              >
                                Cancel
                              </button>
                            ))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
        {cancelError?.kind === "booking" && (
          <p className={`${styles.error} ${styles.section}`}>{cancelError.message}</p>
        )}
      </div>

      <div className={styles.twoCol}>
        <div className={styles.block}>
          <SectionTitle>Classes</SectionTitle>
          <Card className={`${tableStyles.tableCard} ${styles.tableCard}`}>
            <div className={tableStyles.tableWrap}>
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
                        {isToday ? "No class bookings today." : "No class bookings on this date."}
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
          </Card>
        </div>

        <div className={styles.block}>
          <SectionTitle>Class bookings</SectionTitle>
          <Card className={`${tableStyles.tableCard} ${styles.tableCard}`}>
            <div className={tableStyles.tableWrap}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classBookings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={tableStyles.empty}>
                        {isToday ? "No class bookings today." : "No class bookings on this date."}
                      </td>
                    </tr>
                  ) : (
                    classBookings.map((cb) => {
                      const isCancelled = cb.status === "cancelled";
                      const isConfirming = confirmTarget?.kind === "classBooking" && confirmTarget.id === cb.id;
                      return (
                        <tr key={cb.id} className={isCancelled ? styles.mutedRow : ""}>
                          <td>{classById.get(cb.classId)?.name ?? cb.classId}</td>
                          <td>{customerById.get(cb.customerId)?.name ?? `Customer #${cb.customerId}`}</td>
                          <td>
                            <StatusPill variant={bookingStatusVariant(cb.status)}>{cb.status}</StatusPill>
                          </td>
                          <td>
                            {cb.status === "booked" &&
                              (isConfirming ? (
                                <div className={styles.confirmActions}>
                                  <button
                                    type="button"
                                    className={styles.actionLinkWarn}
                                    onClick={handleConfirmCancel}
                                    disabled={cancelling}
                                  >
                                    Confirm cancel
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.actionLink}
                                    onClick={handleKeep}
                                    disabled={cancelling}
                                  >
                                    Keep
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.actionLinkWarn}
                                  onClick={() =>
                                    setConfirmTarget({
                                      kind: "classBooking",
                                      id: cb.id,
                                    })
                                  }
                                >
                                  Cancel
                                </button>
                              ))}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          {cancelError?.kind === "classBooking" && (
            <p className={`${styles.error} ${styles.section}`}>{cancelError.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
