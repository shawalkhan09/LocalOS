"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { ApiRequestError, createPublicClassBooking, getCatalog } from "@/lib/api";
import { addDaysToDateString, formatDateInTimezone, todayInTimezone } from "@/lib/time";
import { BookingConfirmation } from "@/components/BookingConfirmation";
import { PublicCustomerForm, type PublicCustomerInfo } from "@/components/PublicCustomerForm";
import sharedStyles from "@/components/PublicShared.module.css";
import styles from "./page.module.css";

function formatSlotTime(time: string): string {
  const [hourStr, minute] = time.split(":");
  const hour = Number(hourStr);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export default function BookClassPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [classId, setClassId] = useState("");
  const [occurrenceDate, setOccurrenceDate] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedCustomerName, setConfirmedCustomerName] = useState<string | null>(null);

  useEffect(() => {
    getCatalog()
      .then((c) => {
        setConfig(c);
        setOccurrenceDate(todayInTimezone(c.business.timezone));
        if (c.classes[0]) {
          setClassId(c.classes[0].id);
        }
      })
      .catch((err) => {
        setLoadError(err instanceof ApiRequestError ? err.message : "Could not load the booking page.");
      });
  }, []);

  const gymClass = config?.classes.find((c) => c.id === classId) ?? null;

  async function handleCustomerSubmit(info: PublicCustomerInfo) {
    if (!gymClass) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createPublicClassBooking({
        customerName: info.name,
        customerEmail: info.email,
        customerPhone: info.phone,
        classId: gymClass.id,
        occurrenceDate,
      });
      setConfirmedCustomerName(info.name);
    } catch (err) {
      setSubmitError(err instanceof ApiRequestError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className={styles.wrap}>
        <p className={sharedStyles.errorText}>{loadError}</p>
      </div>
    );
  }

  if (!config) {
    return <div className={styles.wrap} />;
  }

  const timezone = config.business.timezone;

  if (confirmedCustomerName && gymClass) {
    return (
      <div className={styles.wrap}>
        <BookingConfirmation
          title="You're booked"
          lines={[
            gymClass.name,
            formatDateInTimezone(occurrenceDate, timezone),
            `Thanks, ${confirmedCustomerName} — see you there.`,
          ]}
        />
      </div>
    );
  }

  if (config.classes.length === 0) {
    return (
      <div className={styles.wrap}>
        <Link href="/" className={sharedStyles.backLink}>
          ← Back
        </Link>
        <p className={sharedStyles.helperText}>No classes are available to book right now.</p>
      </div>
    );
  }

  const minDate = todayInTimezone(timezone);
  const maxDate = addDaysToDateString(minDate, config.booking.advanceBookingDays);

  return (
    <div className={styles.wrap}>
      <Link href="/" className={sharedStyles.backLink}>
        ← Back
      </Link>
      <h1 className={sharedStyles.sectionTitle}>Book a class</h1>

      <div className={sharedStyles.field}>
        <label htmlFor="class">Class</label>
        <select
          id="class"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setShowCustomerForm(false);
          }}
        >
          {config.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {gymClass && (
        <p className={styles.scheduleNote}>
          Meets{" "}
          {gymClass.schedule
            .map((slot) => `${capitalize(slot.day)} at ${formatSlotTime(slot.startTime)}`)
            .join(", ")}
        </p>
      )}

      <div className={sharedStyles.field}>
        <label htmlFor="occurrence-date">Date</label>
        <input
          id="occurrence-date"
          type="date"
          value={occurrenceDate}
          min={minDate}
          max={maxDate}
          onChange={(e) => {
            setOccurrenceDate(e.target.value);
            setShowCustomerForm(false);
          }}
        />
      </div>

      {!showCustomerForm ? (
        <button type="button" className={sharedStyles.pillButton} onClick={() => setShowCustomerForm(true)}>
          Continue
        </button>
      ) : (
        <>
          <h2 className={sharedStyles.sectionTitle}>Your details</h2>
          {submitError && <p className={sharedStyles.errorText}>{submitError}</p>}
          <PublicCustomerForm onSubmit={handleCustomerSubmit} submitting={submitting} submitLabel="Confirm booking" />
        </>
      )}
    </div>
  );
}
