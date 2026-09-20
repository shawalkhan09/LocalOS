"use client";

import { useEffect, useState } from "react";
import { getStaffSchedule, type StaffSchedule } from "@/lib/api";
import { useToast } from "@/components/Toast";
import pageStyles from "../page.module.css";
import styles from "./page.module.css";

export default function SchedulePage() {
  const { showToast } = useToast();
  const [schedule, setSchedule] = useState<StaffSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getStaffSchedule()
      .then((data) => {
        if (!cancelled) {
          setSchedule(data);
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

  // Group items by day
  const itemsByDay = new Map<string, typeof schedule.items>();
  const dayHeadings = new Map<string, string>();

  for (const item of schedule.items) {
    const date = new Date(item.start);
    const dateStr = date.toISOString().split("T")[0];

    if (!itemsByDay.has(dateStr)) {
      itemsByDay.set(dateStr, []);
      const formatter = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      dayHeadings.set(dateStr, formatter.format(date));
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
                  const start = new Date(item.start);
                  const end = new Date(item.end);
                  const startTime = start.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  const endTime = end.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  });

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
