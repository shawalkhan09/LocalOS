"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { ApiRequestError, getCatalog } from "@/lib/api";
import { localWeekday, todayInTimezone } from "@/lib/time";
import sharedStyles from "@/components/PublicShared.module.css";
import styles from "./page.module.css";

export default function PublicLandingPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCatalog()
      .then(setConfig)
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : "Could not load this page.");
      });
  }, []);

  if (error) {
    return (
      <div className={styles.hero}>
        <p className={sharedStyles.errorText}>{error}</p>
      </div>
    );
  }

  if (!config) {
    return <div className={styles.hero} />;
  }

  const timezone = config.business.timezone;
  const today = todayInTimezone(timezone);
  const todayHours = config.businessHours.find((h) => h.day === localWeekday(today, timezone));

  return (
    <div>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>{config.business.name}</h1>
        {config.business.description && <p className={styles.heroDescription}>{config.business.description}</p>}
        <div className={styles.ctaRow}>
          <Link href="/book/session" className={sharedStyles.pillButton}>
            Book a session
          </Link>
          <Link href="/book/class" className={sharedStyles.pillButtonSecondary}>
            Book a class
          </Link>
        </div>
        <p className={styles.hoursNote}>
          {todayHours ? (
            <>
              Today: <strong>{todayHours.openTime}–{todayHours.closeTime}</strong>
            </>
          ) : (
            <strong>Closed today</strong>
          )}
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={sharedStyles.sectionTitle}>Services</h2>
        <div className={styles.list}>
          {config.services.map((service) => (
            <div key={service.id} className={sharedStyles.card}>
              <p className={styles.itemTitle}>{service.name}</p>
              <p className={styles.itemMeta}>
                <span>{service.durationMinutes} min</span>
                {service.price > 0 && <span>${service.price}</span>}
              </p>
              {service.description && <p className={styles.itemDescription}>{service.description}</p>}
            </div>
          ))}
        </div>
      </section>

      {config.classes.length > 0 && (
        <section className={styles.section}>
          <h2 className={sharedStyles.sectionTitle}>Classes</h2>
          <div className={styles.list}>
            {config.classes.map((gymClass) => (
              <div key={gymClass.id} className={sharedStyles.card}>
                <p className={styles.itemTitle}>{gymClass.name}</p>
                <p className={styles.itemMeta}>{gymClass.durationMinutes} min</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
