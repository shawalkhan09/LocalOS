"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCatalog, getMe, logout } from "@/lib/api";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Today" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/new-booking", label: "New booking" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCatalog()
      .then((config) => {
        if (!cancelled) {
          setBusinessName(config.business.name);
        }
      })
      .catch(() => {
        // Sidebar chrome degrades gracefully — the page body surfaces the
        // real fetch error, the sidebar just falls back to a generic label.
      });
    getMe()
      .then((user) => {
        if (!cancelled) {
          setUserEmail(user.email);
        }
      })
      .catch(() => {
        // A 401 here already redirects to /login via lib/api.ts.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.push("/login");
    }
  }

  return (
    <nav className={styles.sidebar} aria-label="Main">
      <p className={styles.businessName}>{businessName ?? "LocalOS"}</p>
      <div className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      {userEmail && (
        <div className={styles.account}>
          <p className={styles.accountEmail}>{userEmail}</p>
          <button type="button" className={styles.logout} onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}
    </nav>
  );
}
