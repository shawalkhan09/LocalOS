"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { getCatalog } from "@/lib/api";
import styles from "./layout.module.css";

// Falls back to a neutral gray until config loads — never Ironclad's own
// red, so a slow-loading page for a *different* client never flashes the
// wrong brand's color.
const DEFAULT_ACCENT = "#6B7280";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ClientConfig | null>(null);

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

  const accent = config?.business.primaryColor ?? DEFAULT_ACCENT;

  return (
    <div className={styles.shell} style={{ "--public-accent": accent } as React.CSSProperties}>
      <header className={styles.header}>
        <Link href="/" className={styles.businessName}>
          {config?.business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.business.logoUrl} alt="" className={styles.logo} />
          ) : (
            <span className={styles.logoPlaceholder} aria-hidden="true" />
          )}
        </Link>
        <Link href="/" className={styles.businessName}>
          {config?.business.name ?? "Loading…"}
        </Link>
        <Link href="/login" className={styles.headerLink}>
          Log in
        </Link>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        {config && (
          <>
            {config.contact.address.street}, {config.contact.address.city}, {config.contact.address.state}{" "}
            {config.contact.address.zip}
            <br />
            <a href={`tel:${config.contact.phone}`}>{config.contact.phone}</a>
            <br />
            <a href={`mailto:${config.contact.email}`}>{config.contact.email}</a>
          </>
        )}
      </footer>
    </div>
  );
}
