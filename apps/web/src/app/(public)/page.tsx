"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { ApiRequestError, getCatalog } from "@/lib/api";
import { localWeekday, todayInTimezone } from "@/lib/time";
import { PublicButton } from "./_components/PublicButton";
import { PublicPanel } from "./_components/PublicPanel";
import { Divider } from "./_components/Divider";
import { CountUpStat } from "./_components/CountUpStat";
import styles from "./page.module.css";

const TEASERS = [
  {
    href: "/classes",
    title: "Classes",
    body: "Structured strength and conditioning sessions, programmed and scheduled every week.",
  },
  {
    href: "/trainers",
    title: "Trainers",
    body: "Coaches with the certifications and specialties to back up every rep they call out.",
  },
  {
    href: "/membership",
    title: "Membership",
    body: "Straightforward monthly and annual plans, no hidden fees.",
  },
] as const;

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
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (!config) {
    return <div className={styles.hero} />;
  }

  const timezone = config.business.timezone;
  const today = todayInTimezone(timezone);
  const todayHours = config.businessHours.find((h) => h.day === localWeekday(today, timezone));
  const disciplineCount = new Set(config.classes.map((c) => c.category).filter((c): c is string => Boolean(c))).size;

  return (
    <div>
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroBgOverlay} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={`pubIndexLabel ${styles.heroBadge}`}>
            {config.business.name} // {config.contact.address.city}
          </p>
          <h1 className={styles.heroTitle}>Strength training, run with discipline.</h1>
          <p className={styles.heroDescription}>
            {config.business.description ??
              "Programmed strength and conditioning coaching, built around measurable progress — not guesswork."}
          </p>
          <div className={styles.ctaRow}>
            <PublicButton href="/book/session" variant="primary">
              Book a session
            </PublicButton>
            <PublicButton href="/membership" variant="ghost">
              View membership plans
            </PublicButton>
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
        </div>
      </section>

      <section className={styles.statsSection}>
        <PublicPanel className={styles.statsPanel}>
          <CountUpStat value={config.classes.length} label="Classes scheduled" />
          <Divider direction="vertical" className={styles.statsDivider} />
          <CountUpStat value={config.trainers.length} label="Coaches on staff" />
          <Divider direction="vertical" className={styles.statsDivider} />
          <CountUpStat value={disciplineCount} label="Training disciplines" />
        </PublicPanel>
      </section>

      <section className={styles.teaserSection}>
        <div className={styles.teaserGrid}>
          {TEASERS.map((teaser) => (
            <Link key={teaser.href} href={teaser.href} className={styles.teaserLink}>
              <PublicPanel className={styles.teaserPanel}>
                <h2 className={styles.teaserTitle}>{teaser.title}</h2>
                <p className={styles.teaserBody}>{teaser.body}</p>
                <span className={styles.teaserArrow} aria-hidden="true">
                  →
                </span>
              </PublicPanel>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
