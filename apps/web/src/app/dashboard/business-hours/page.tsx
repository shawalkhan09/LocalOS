"use client";

import { useEffect, useState } from "react";
import type { BusinessHoursSlot, Weekday } from "@localos/config-schema";
import { ApiRequestError, getCatalog, getMe, updateBusinessHours } from "@/lib/api";
import { useToast } from "@/components/Toast";
import formStyles from "@/components/FormField.module.css";
import { Button, Card } from "@/components";
import pageStyles from "../page.module.css";
import styles from "./page.module.css";

const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

type DayState = { open: boolean; openTime: string; closeTime: string };
type WeekState = Record<Weekday, DayState>;

function defaultDayState(): DayState {
  return { open: false, openTime: "09:00", closeTime: "17:00" };
}

function weekFromSlots(slots: BusinessHoursSlot[]): WeekState {
  const week = Object.fromEntries(WEEKDAYS.map((day) => [day, defaultDayState()])) as WeekState;
  for (const slot of slots) {
    week[slot.day] = { open: true, openTime: slot.openTime, closeTime: slot.closeTime };
  }
  return week;
}

export default function BusinessHoursPage() {
  const { showToast } = useToast();

  const [week, setWeek] = useState<WeekState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getCatalog(), getMe()])
      .then(([catalogRes, meRes]) => {
        // Same defense-in-depth reasoning as Services/Classes: the nav
        // link is hidden for staff logins, but a staff user navigating
        // here directly by URL would otherwise see the management UI,
        // even though PATCH /business-hours is requireOwner-gated
        // server-side and 403s regardless.
        if (meRes.role !== "owner") {
          setForbidden(true);
          return;
        }
        setWeek(weekFromSlots(catalogRes.businessHours));
      })
      .catch((err) => {
        setLoadError(err instanceof ApiRequestError ? err.message : "Could not load business hours.");
      });
  }, []);

  function updateDay(day: Weekday, patch: Partial<DayState>) {
    setWeek((prev) => (prev ? { ...prev, [day]: { ...prev[day], ...patch } } : prev));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!week) {
      return;
    }
    setSubmitting(true);
    try {
      const slots: BusinessHoursSlot[] = WEEKDAYS.filter((day) => week[day].open).map((day) => ({
        day,
        openTime: week[day].openTime,
        closeTime: week[day].closeTime,
      }));
      await updateBusinessHours(slots);
      showToast("Business hours saved.", "success");
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not save business hours.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (forbidden) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Business hours</h1>
        <p className={`${pageStyles.error} ${pageStyles.section}`}>
          Only the account owner can manage business hours.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Business hours</h1>
        <p className={`${pageStyles.error} ${pageStyles.section}`}>{loadError}</p>
      </div>
    );
  }

  if (!week) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Business hours</h1>
      </div>
    );
  }

  return (
    <div>
      <h1 className={pageStyles.heading}>Business hours</h1>
      <p className={pageStyles.subheading}>A day left closed won&apos;t take bookings.</p>

      <Card className={pageStyles.section}>
        <form className={formStyles.form} onSubmit={handleSave} style={{ maxWidth: "none" }}>
          {WEEKDAYS.map((day) => (
            <div key={day} className={styles.dayRow}>
              <label className={styles.dayLabel}>
                <input
                  type="checkbox"
                  checked={week[day].open}
                  onChange={(e) => updateDay(day, { open: e.target.checked })}
                />
                <span className={styles.dayName}>{day}</span>
              </label>
              {week[day].open ? (
                <div className={styles.timeControls}>
                  <input
                    type="time"
                    value={week[day].openTime}
                    onChange={(e) => updateDay(day, { openTime: e.target.value })}
                  />
                  <span>to</span>
                  <input
                    type="time"
                    value={week[day].closeTime}
                    onChange={(e) => updateDay(day, { closeTime: e.target.value })}
                  />
                </div>
              ) : (
                <span className={styles.closedLabel}>Closed</span>
              )}
            </div>
          ))}
          <Button type="submit" className={formStyles.submit} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
