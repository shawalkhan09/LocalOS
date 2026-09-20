"use client";

import { useEffect, useState } from "react";
import { getStaffSchedule, getCatalog, type StaffSchedule } from "@/lib/api";
import { formatTimeInTimezone, formatDateInTimezone, dateStringInTimezone } from "@/lib/time";
import { useToast } from "@/components/Toast";
import pageStyles from "../page.module.css";
import styles from "./page.module.css";

export default function SchedulePage() {
  const { showToast } = useToast();
  const [schedule, setSchedule] = useState<StaffSchedule | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getStaffSchedule(), getCatalog()])
      .then(([data, catalog]) => {
        if (!cancelled) {
          setSchedule(data);
          setTimezone(catalog.business.timezone);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          showToast("Could not load schedule.", "error");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  if (loading) {
    return (
      <div>
        <h1 className={pageStyles.heading}>My schedule</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div>
        <h1 className={pageStyles.heading}>My schedule</h1>
        <p>Could not load schedule.</p>
      </div>
    );
  }

  if (!schedule.linked) {
    return (
      <div>
        <h1 className={pageStyles.heading}>My schedule</h1>
        <div className={pageStyles.section}>
          <p className={styles.notLinked}>
            Your account is not linked to a staff member yet. Ask the owner to link it on the Team page.
          </p>
        </div>
      </div>
    );
  }

  if (schedule.items.length === 0) {
    return (
      <div>
        <h1 className={pageStyles.heading}>My schedule</h1>
        <div className={pageStyles.section}>
          <p className={styles.empty}>No upcoming sessions in the next 14 days.</p>
        </div>
      </div>
    );
  }

  // Group items by day (in business timezone)
  const itemsByDay = new Map<string, typeof schedule.items>();
  const dayHeadings = new Map<string, string>();

  for (const item of schedule.items) {
    const dateStr = dateStringInTimezone(item.start, timezone!);

    if (!itemsByDay.has(dateStr)) {
      itemsByDay.set(dateStr, []);
      dayHeadings.set(dateStr, formatDateInTimezone(dateStr, timezone!));
    }

    itemsByDay.get(dateStr)!.push(item);
  }

  const sortedDays = Array.from(itemsByDay.keys()).sort();

  return (
    <div>
      <h1 className={pageStyles.heading}>My schedule</h1>

      <div className={pageStyles.section}>
        {sortedDays.map((dayStr) => {
          const dayItems = itemsByDay.get(dayStr)!;
          const heading = dayHeadings.get(dayStr)!;

          return (
            <div key={dayStr} className={styles.day}>
              <h2 className={styles.dayHeading}>{heading}</h2>
              <div className={styles.items}>
                {dayItems.map((item, idx) => {
                  const startTime = formatTimeInTimezone(item.start, timezone!);
                  const endTime = formatTimeInTimezone(item.end, timezone!);

                  return (
                    <div key={idx} className={styles.item}>
                      <div className={styles.time}>
                        {startTime} – {endTime}
                      </div>
                      <div className={styles.content}>
                        <div className={styles.label}>{item.label}</div>
                        {item.type === "booking" && item.customerName && (
                          <div className={styles.detail}>{item.customerName}</div>
                        )}
                        {item.type === "class" && item.seatCount !== undefined && (
                          <div className={styles.detail}>{item.seatCount} seat{item.seatCount === 1 ? "" : "s"}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
