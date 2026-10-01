"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSiteCatalog } from "./SiteShell";
import styles from "./PublicNav.module.css";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/classes", label: "Classes" },
  { href: "/trainers", label: "Trainers" },
  { href: "/membership", label: "Membership" },
  { href: "/contact", label: "Contact" },
];

export function PublicNav() {
  const config = useSiteCatalog();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Open: move focus into the menu. Escape closes it and returns focus to the toggle.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const links = (
    <>
      {NAV_LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`${styles.link} ${pathname === l.href ? styles.linkActive : ""}`}
          aria-current={pathname === l.href ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          {l.label}
        </Link>
      ))}
    </>
  );

  return (
    <header className={styles.nav}>
      <Link href="/" className={styles.brand}>
        {config?.business.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.business.logoUrl} alt="" className={styles.logoImg} />
        ) : (
          <span className={styles.logoMark} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9v6M8 6v12M16 6v12M20 9v6M8 12h8" />
            </svg>
          </span>
        )}
        {config?.business.name ?? "…"}
      </Link>

      <nav className={styles.pill} aria-label="Main">
        {links}
      </nav>

      <Link href="/book/session" className={`${styles.book} ${styles.desktopBook}`}>
        Book a session
      </Link>

      <button
        type="button"
        ref={buttonRef}
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <nav id="site-menu" ref={panelRef} className={styles.panel} aria-label="Menu">
          {links}
          <Link href="/book/session" className={styles.book} onClick={() => setOpen(false)}>
            Book a session
          </Link>
        </nav>
      )}
    </header>
  );
}
