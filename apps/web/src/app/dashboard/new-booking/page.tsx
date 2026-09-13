"use client";

import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import {
  ApiRequestError,
  type AvailabilitySlot,
  type Customer,
  checkAvailability,
  createBooking,
  getCatalog,
  getCustomers,
} from "@/lib/api";
import { addDaysToDateString, formatTimeInTimezone, todayInTimezone } from "@/lib/time";
import { CustomerPickerModal } from "@/components/CustomerPickerModal";
import { useToast } from "@/components/Toast";
import pageStyles from "../page.module.css";
import styles from "./page.module.css";

type ConfirmedEntry = { id: number; time: string; customerName: string; serviceName: string };

export default function NewBookingPage() {
  const { showToast } = useToast();

  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCatalog(), getCustomers()])
      .then(([catalog, customerRows]) => {
        if (cancelled) {
          return;
        }
        setConfig(catalog);
        setCustomers(customerRows);
        const today = todayInTimezone(catalog.business.timezone);
        setDate(today);
        if (catalog.services[0]) {
          setServiceId(catalog.services[0].id);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiRequestError ? err.message : "Could not load booking form.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const service = config?.services.find((s) => s.id === serviceId) ?? null;
  const eligibleStaff = config
    ? service?.staffIds
      ? config.staff.filter((s) => service.staffIds?.includes(s.id))
      : config.staff
    : [];

  useEffect(() => {
    setStaffId("");
  }, [serviceId]);

  useEffect(() => {
    setSelectedSlot(null);
    setSlots([]);
    setSlotsError(null);
    if (!config || !serviceId || !date) {
      return;
    }
    let cancelled = false;
    checkAvailability({ serviceId, date, staffId: staffId || undefined })
      .then((res) => {
        if (!cancelled) {
          setSlots(res.slots);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSlotsError(err instanceof ApiRequestError ? err.message : "Could not check availability.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [config, serviceId, staffId, date]);

  if (loadError) {
    return (
      <div>
        <h1 className={pageStyles.heading}>New booking</h1>
        <p className={`${pageStyles.error} ${pageStyles.section}`}>{loadError}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div>
        <h1 className={pageStyles.heading}>New booking</h1>
      </div>
    );
  }

  const timezone = config.business.timezone;
  const minDate = todayInTimezone(timezone);
  const maxDate = addDaysToDateString(minDate, config.booking.advanceBookingDays);
  const canSubmit = Boolean(service && selectedSlot && customer) && !submitting;

  async function handleSubmit() {
    if (!service || !selectedSlot || !customer) {
      return;
    }
    setSubmitting(true);
    try {
      await createBooking({
        customerId: customer.id,
        serviceId: service.id,
        staffId: staffId || undefined,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });
      setConfirmed((prev) => [
        {
          id: Date.now(),
          time: formatTimeInTimezone(selectedSlot.startTime, timezone),
          customerName: customer.name,
          serviceName: service.name,
        },
        ...prev,
      ]);
      showToast(`Booking confirmed for ${customer.name}.`, "success");
      setSelectedSlot(null);
      setCustomer(null);
      // Re-check availability so the just-booked slot disappears from the list.
      const res = await checkAvailability({ serviceId: service.id, date, staffId: staffId || undefined });
      setSlots(res.slots);
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not create booking.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className={pageStyles.heading}>New booking</h1>
      <p className={pageStyles.subheading}>Book a one-off appointment for a customer.</p>

      <div className={styles.form}>
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
          <label htmlFor="staff">Staff</label>
          <select id="staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Any available</option>
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

        <div className={styles.field}>
          <span id="slots-label" className={styles.fieldLabel}>
            Available times
          </span>
          {slotsError ? (
            <p className={pageStyles.error}>{slotsError}</p>
          ) : slots.length === 0 ? (
            <p className={styles.slotsEmpty}>No open times for this selection.</p>
          ) : (
            <div className={styles.slots} role="group" aria-labelledby="slots-label">
              {slots.map((slot) => (
                <button
                  key={slot.startTime}
                  type="button"
                  className={`${styles.slot} ${selectedSlot?.startTime === slot.startTime ? styles.slotSelected : ""}`}
                  aria-pressed={selectedSlot?.startTime === slot.startTime}
                  onClick={() => setSelectedSlot(slot)}
                >
                  {formatTimeInTimezone(slot.startTime, timezone)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Customer</span>
          <div className={`${styles.customerRow} ${customer ? "" : styles.customerRowEmpty}`}>
            {customer ? customer.name : "No customer selected"}
            <button type="button" className={styles.linkButton} onClick={() => setShowCustomerModal(true)}>
              {customer ? "Change" : "Choose customer"}
            </button>
          </div>
        </div>

        <button type="button" className={styles.submit} disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? "Booking…" : "Confirm booking"}
        </button>
      </div>

      {confirmed.length > 0 && (
        <div className={styles.confirmedSection}>
          <p className={styles.confirmedTitle}>Confirmed this session</p>
          {confirmed.map((c) => (
            <div key={c.id} className={`${styles.confirmedRow} row-confirm`}>
              <span className={styles.confirmedTime}>{c.time}</span>
              <span>{c.customerName}</span>
              <span className={styles.confirmedService}>{c.serviceName}</span>
            </div>
          ))}
        </div>
      )}

      {showCustomerModal && (
        <CustomerPickerModal
          customers={customers}
          onClose={() => setShowCustomerModal(false)}
          onPick={(picked) => {
            setCustomer(picked);
            setCustomers((prev) => (prev.some((c) => c.id === picked.id) ? prev : [...prev, picked]));
            setShowCustomerModal(false);
          }}
        />
      )}
    </div>
  );
}
