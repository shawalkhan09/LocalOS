"use client";

import type { Weekday } from "@localos/config-schema";
import { localWeekday, todayInTimezone } from "@/lib/time";
import { useSiteCatalog } from "./SiteShell";
import styles from "./PublicFooter.module.css";

export function PublicFooter() {
  const config = useSiteCatalog();
  if (!config) return <footer className={styles.footer} />;

  const { business, contact, businessHours } = config;
  const a = contact.address;
  const address = [a.street, a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  const today = localWeekday(todayInTimezone(business.timezone), business.timezone) as Weekday;
  const slot = businessHours.find((h) => h.day === today);
  const hours = slot ? `Today ${slot.openTime}–${slot.closeTime}` : "Closed today";

  return (
    <footer className={styles.footer}>
      <div className={styles.grid}>
        <div className={styles.col}>
          <span className={styles.name}>{business.name}</span>
          {business.description && <span className={styles.desc}>{business.description}</span>}
        </div>
        <div className={styles.col}>
          <span className={styles.heading}>Visit</span>
          {address && <span className={styles.muted}>{address}</span>}
          {businessHours.length > 0 && <span className={styles.muted}>{hours}</span>}
        </div>
        <div className={styles.col}>
          <span className={styles.heading}>Contact</span>
          {contact.phone && <a href={`tel:${contact.phone}`} className={styles.muted}>{contact.phone}</a>}
          {contact.email && <a href={`mailto:${contact.email}`} className={styles.muted}>{contact.email}</a>}
        </div>
      </div>
      <div className={styles.copy}>© {business.name}</div>
    </footer>
  );
}
