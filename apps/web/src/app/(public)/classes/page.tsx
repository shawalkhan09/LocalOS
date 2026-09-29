"use client";

import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { ApiRequestError, getCatalog } from "@/lib/api";
import { PublicButton } from "../_components/PublicButton";
import { PublicPanel } from "../_components/PublicPanel";
import styles from "./page.module.css";

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function formatSlotTime(time: string): string {
  const [hourStr, minute] = time.split(":");
  const hour = Number(hourStr);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}

export default function ClassesPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCatalog()
      .then(setConfig)
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : "Could not load classes.");
      });
  }, []);

  if (error) {
    return (
      <div className={styles.wrap}>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (!config) {
    return <div className={styles.wrap} />;
  }

  const trainerNameByTrainerId = new Map(
    config.trainers.map((trainer) => {
      const staff = config.staff.find((s) => s.id === trainer.staffId);
      return [trainer.id, staff?.name ?? "Unassigned"];
    }),
  );

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <p className="pubIndexLabel">01 / CLASSES</p>
        <h1 className={styles.title}>Scheduled classes</h1>
        <p className={styles.subtitle}>Programmed strength and conditioning sessions, run every week.</p>
      </header>

      {config.classes.length === 0 ? (
        <p className={styles.empty}>No classes are scheduled right now.</p>
      ) : (
        <div className={styles.list}>
          {config.classes.map((gymClass) => (
            <PublicPanel key={gymClass.id} className={styles.classPanel}>
              <div className={styles.classInfo}>
                <h2 className={styles.className}>{gymClass.name}</h2>
                <div className={styles.classMeta}>
                  {gymClass.category && <span>{gymClass.category}</span>}
                  <span>{gymClass.durationMinutes} min</span>
                  <span>Cap {gymClass.capacity}</span>
                  <span>Coach {trainerNameByTrainerId.get(gymClass.trainerId) ?? "Unassigned"}</span>
                </div>
                <PublicButton href="/book/class" variant="secondary" className={styles.bookButton}>
                  Book this class
                </PublicButton>
              </div>

              <ul className={styles.scheduleList}>
                {gymClass.schedule.map((slot, i) => (
                  <li key={`${slot.day}-${slot.startTime}-${i}`} className={styles.scheduleSlot}>
                    <span>{capitalize(slot.day)}</span>
                    <span className={styles.scheduleTime}>{formatSlotTime(slot.startTime)}</span>
                  </li>
                ))}
              </ul>
            </PublicPanel>
          ))}
        </div>
      )}
    </div>
  );
}
