"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ClientConfig, Weekday } from "@localos/config-schema";
import { getCatalog } from "@/lib/api";
import { PublicButton } from "./_components/PublicButton";
import "./public-theme.css";
import styles from "./layout.module.css";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/classes", label: "Classes" },
  { href: "/trainers", label: "Trainers" },
  { href: "/membership", label: "Membership" },
  { href: "/contact", label: "Contact" },
];

const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    getCatalog()
      .then((c) => {
        if (!cancelled) {
          setConfig(c);
        }
      })
      .catch(() => {
        // Pages below handle their own fetch errors; the shell degrades to
        // a generic look rather than blocking on it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hoursByDay = new Map(config?.businessHours.map((h) => [h.day, h]));

  return (
    <div className={styles.shell + " publicTheme"}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          {config?.business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.business.logoUrl} alt="" className={styles.logo} />
          ) : (
            <span className={styles.logoPlaceholder} aria-hidden="true" />
          )}
          <span className={styles.businessName}>{config?.business.name ?? "Loading…"}</span>
        </Link>

        <nav className={styles.nav} aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${pathname === link.href ? styles.navLinkActive : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <Link href="/login" className={styles.loginLink}>
            Log in
          </Link>
          <PublicButton href="/book/session" variant="primary" className={styles.headerCta}>
            Book a session
          </PublicButton>
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        {config && (
          <div className={styles.footerGrid}>
            <div className={styles.footerColumn}>
              <p className={styles.footerBusinessName}>{config.business.name}</p>
              {config.business.description && <p className={styles.footerDescription}>{config.business.description}</p>}
              <p className={styles.footerContactLine}>
                {config.contact.address.street}, {config.contact.address.city}, {config.contact.address.state}{" "}
                {config.contact.address.zip}
              </p>
              <p className={styles.footerContactLine}>
                <a href={`tel:${config.contact.phone}`}>{config.contact.phone}</a>
              </p>
              <p className={styles.footerContactLine}>
                <a href={`mailto:${config.contact.email}`}>{config.contact.email}</a>
              </p>
            </div>

            <div className={styles.footerColumn}>
              <p className={styles.footerHeading}>Business hours</p>
              <table className={styles.hoursTable}>
                <tbody>
                  {WEEKDAYS.map((day) => {
                    const slot = hoursByDay.get(day);
                    return (
                      <tr key={day}>
                        <td>{capitalize(day)}</td>
                        <td className={styles.hoursValue}>{slot ? `${slot.openTime}–${slot.closeTime}` : "Closed"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={styles.footerColumn}>
              <p className={styles.footerHeading}>Quick links</p>
              <ul className={styles.footerLinks}>
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
