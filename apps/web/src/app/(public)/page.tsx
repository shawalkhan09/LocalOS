"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { ApiRequestError, getCatalog } from "@/lib/api";
import { localWeekday, nowTimeInTimezone, todayInTimezone } from "@/lib/time";
import { PublicButton } from "./_components/PublicButton";
import { PublicPanel } from "./_components/PublicPanel";
import { Divider } from "./_components/Divider";
import { CountUpStat } from "./_components/CountUpStat";
import { FadeUpOnScroll } from "./_components/FadeUpOnScroll";
import styles from "./page.module.css";

function formatSlotTime(time: string): string {
  const [hourStr, minute] = time.split(":");
  const hour = Number(hourStr);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}

// Soonest schedule slot today at/after the current time, across every
// class — not a fabricated "spots left" figure, just what's already in
// ClientConfig. capacity is surfaced honestly labeled ("Capacity: N"),
// never phrased as remaining/available seats (the catalog has no live
// booking counts to back that up).
function getNextClassToday(
  classes: ClientConfig["classes"],
  weekday: string,
  currentTime: string,
): { name: string; startTime: string; capacity: number } | null {
  let best: { name: string; startTime: string; capacity: number } | null = null;
  for (const gymClass of classes) {
    for (const slot of gymClass.schedule) {
      if (slot.day.toLowerCase() === weekday && slot.startTime >= currentTime) {
        if (!best || slot.startTime < best.startTime) {
          best = { name: gymClass.name, startTime: slot.startTime, capacity: gymClass.capacity };
        }
      }
    }
  }
  return best;
}

function ClassesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--pub-accent-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}

function TrainersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--pub-accent-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

function MembershipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--pub-accent-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" />
      <path d="M9 6v12" strokeDasharray="2 2" />
    </svg>
  );
}

const TEASERS = [
  {
    href: "/classes",
    title: "Classes",
    body: "Structured strength and conditioning sessions, programmed and scheduled every week.",
    Icon: ClassesIcon,
  },
  {
    href: "/trainers",
    title: "Trainers",
    body: "Coaches with the certifications and specialties to back up every rep they call out.",
    Icon: TrainersIcon,
  },
  {
    href: "/membership",
    title: "Membership",
    body: "Straightforward monthly and annual plans, no hidden fees.",
    Icon: MembershipIcon,
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
  const weekday = localWeekday(today, timezone);
  const currentTime = nowTimeInTimezone(timezone);
  const todayHours = config.businessHours.find((h) => h.day === weekday);
  const isOpenNow = Boolean(todayHours && currentTime >= todayHours.openTime && currentTime < todayHours.closeTime);
  const nextClass = getNextClassToday(config.classes, weekday, currentTime);
  const disciplineCount = new Set(config.classes.map((c) => c.category).filter((c): c is string => Boolean(c))).size;

  return (
    <div>
      <section className={styles.hero}>
        <div className={styles.heroDecor} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
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

          <PublicPanel className={styles.heroPanel}>
            <div className={styles.heroPanelStatusRow}>
              <span className={styles.statusDot} aria-hidden="true" />
              <span className={styles.heroPanelStatusText}>{isOpenNow ? "Open now" : "Closed now"}</span>
            </div>
            <p className={styles.heroPanelHours}>
              {todayHours ? `${todayHours.openTime}–${todayHours.closeTime}` : "Closed today"}
            </p>

            <Divider className={styles.heroPanelDivider} />

            <p className={styles.heroPanelLabel}>Next class today</p>
            {nextClass ? (
              <>
                <p className={styles.heroPanelClassName}>{nextClass.name}</p>
                <p className={styles.heroPanelClassMeta}>
                  {formatSlotTime(nextClass.startTime)} · Capacity: {nextClass.capacity}
                </p>
              </>
            ) : (
              <p className={styles.heroPanelClassName}>No more classes today</p>
            )}
          </PublicPanel>
        </div>
      </section>

      <section className={styles.statsSection}>
        <FadeUpOnScroll>
          <PublicPanel className={styles.statsPanel}>
            <CountUpStat value={config.classes.length} label="Classes scheduled" indexLabel="01 / CLASSES" />
            <Divider direction="vertical" className={styles.statsDivider} />
            <CountUpStat value={config.trainers.length} label="Coaches on staff" indexLabel="02 / COACHES" />
            <Divider direction="vertical" className={styles.statsDivider} />
            <CountUpStat value={disciplineCount} label="Training disciplines" indexLabel="03 / DISCIPLINES" />
          </PublicPanel>
        </FadeUpOnScroll>
      </section>

      <section className={styles.teaserSection}>
        <div className={styles.teaserGrid}>
          {TEASERS.map((teaser, i) => (
            <FadeUpOnScroll key={teaser.href} className={styles.teaserFadeWrap}>
              <Link href={teaser.href} className={styles.teaserLink}>
                <PublicPanel className={styles.teaserPanel}>
                  <span className={styles.teaserIndex}>{String(i + 1).padStart(2, "0")}</span>
                  <div className={styles.teaserIconTile}>
                    <teaser.Icon />
                  </div>
                  <h2 className={styles.teaserTitle}>{teaser.title}</h2>
                  <p className={styles.teaserBody}>{teaser.body}</p>
                  <span className={styles.teaserArrow} aria-hidden="true">
                    →
                  </span>
                </PublicPanel>
              </Link>
            </FadeUpOnScroll>
          ))}
        </div>
      </section>
    </div>
  );
}
