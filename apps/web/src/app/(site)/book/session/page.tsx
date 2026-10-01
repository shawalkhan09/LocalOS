"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import {
  ApiRequestError,
  type AvailabilitySlot,
  checkAvailability,
  createPublicBooking,
  getCatalog,
} from "@/lib/api";
import { addDaysToDateString, formatTimeInTimezone, todayInTimezone } from "@/lib/time";
import { PublicButton } from "../../_components/PublicButton";
import { PublicPanel } from "../../_components/PublicPanel";
import { BookingConfirmation } from "@/components/BookingConfirmation";
import { PublicCustomerForm, type PublicCustomerInfo } from "@/components/PublicCustomerForm";
import styles from "./page.module.css";

export default function BookSessionPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedCustomerName, setConfirmedCustomerName] = useState<string | null>(null);

  useEffect(() => {
    getCatalog()
      .then((c) => {
        setConfig(c);
        setDate(todayInTimezone(c.business.timezone));
        if (c.services[0]) {
          setServiceId(c.services[0].id);
        }
      })
      .catch((err) => {
        setLoadError(err instanceof ApiRequestError ? err.message : "Could not load the booking page.");
      });
  }, []);

  const service = config?.services.find((s) => s.id === serviceId) ?? null;
  const isStaffRestricted = Boolean(service?.staffIds && service.staffIds.length > 0);
  const eligibleStaff = config
    ? service?.staffIds
      ? config.staff.filter((s) => service.staffIds?.includes(s.id))
      : config.staff
    : [];
  const needsStaffSelection = isStaffRestricted && !staffId;

  useEffect(() => {
    setStaffId("");
  }, [serviceId]);

  useEffect(() => {
    setSelectedSlot(null);
    setSlots([]);
    setSlotsError(null);
    if (!config || !serviceId || !date || needsStaffSelection) {
      return;
    }
    checkAvailability({ serviceId, date, staffId: staffId || undefined })
      .then((res) => setSlots(res.slots))
      .catch((err) => {
        setSlotsError(err instanceof ApiRequestError ? err.message : "Could not check availability.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, serviceId, staffId, date, needsStaffSelection]);

  async function handleCustomerSubmit(info: PublicCustomerInfo) {
    if (!service || !selectedSlot) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createPublicBooking({
        customerName: info.name,
        customerEmail: info.email,
        customerPhone: info.phone,
        serviceId: service.id,
        staffId: staffId || undefined,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
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
        <p className={styles.errorText}>{loadError}</p>
      </div>
    );
  }

  if (!config) {
    return <div className={styles.wrap} />;
  }

  const timezone = config.business.timezone;

  if (confirmedCustomerName && service && selectedSlot) {
    return (
      <div className={styles.wrap}>
        <BookingConfirmation
          title="You're booked"
          lines={[
            service.name,
            `${formatTimeInTimezone(selectedSlot.startTime, timezone)} on ${date}`,
            `Thanks, ${confirmedCustomerName} — see you then.`,
          ]}
        />
      </div>
    );
  }

  const minDate = todayInTimezone(timezone);
  const maxDate = addDaysToDateString(minDate, config.booking.advanceBookingDays);

  return (
    <div className={styles.wrap}>
      <Link href="/" className={styles.backLink}>
        ← Back
      </Link>
      <p className="pubIndexLabel">BOOK</p>
      <h1 className={styles.title}>Book a session</h1>

      <PublicPanel className={styles.panel}>
        <div className={styles.field}>
          <label htmlFor="service">Service</label>
          <select id="service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {config.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.durationMinutes} min)
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="staff">Trainer</label>
          <select id="staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {isStaffRestricted ? (
              <option value="" disabled>
                Select a trainer
              </option>
            ) : (
              <option value="">No preference</option>
            )}
            {eligibleStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="date">Date</label>
          <input
            id="date"
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {needsStaffSelection ? (
          <p className={styles.helperText}>Choose a trainer to see available times.</p>
        ) : slotsError ? (
          <p className={styles.errorText}>{slotsError}</p>
        ) : slots.length === 0 ? (
          <p className={styles.helperText}>No open times for this selection.</p>
        ) : (
          <div className={styles.slots} role="group" aria-label="Available times">
            {slots.map((slot) => (
              <PublicButton
                key={slot.startTime}
                type="button"
                variant={selectedSlot?.startTime === slot.startTime ? "primary" : "ghost"}
                aria-pressed={selectedSlot?.startTime === slot.startTime}
                className={styles.slotButton}
                onClick={() => setSelectedSlot(slot)}
              >
                {formatTimeInTimezone(slot.startTime, timezone)}
              </PublicButton>
            ))}
          </div>
        )}
      </PublicPanel>

      {selectedSlot && (
        <PublicPanel className={styles.panel}>
          <h2 className={styles.subheading}>Your details</h2>
          {submitError && <p className={styles.errorText}>{submitError}</p>}
          <PublicCustomerForm onSubmit={handleCustomerSubmit} submitting={submitting} submitLabel="Confirm booking" />
        </PublicPanel>
      )}
    </div>
  );
}
