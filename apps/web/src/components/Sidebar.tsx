"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCatalog, getMe, logout } from "@/lib/api";
import styles from "./Sidebar.module.css";

const BASE_NAV_ITEMS = [
  { href: "/dashboard", label: "Today" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/new-booking", label: "New booking" },
];

// Team and Staff are appended only for role === "owner" — hiding the links
// is not the actual security boundary (the underlying API routes still
// 403 a staff session regardless), just keeps a staff user from seeing a
// link to a page they can't use. See requireOwner in
// apps/api/src/auth/middleware.ts for the real gate, and /dashboard/team
// and /dashboard/staff for the defense-in-depth 403 handling.
const OWNER_NAV_ITEMS = [
  { href: "/dashboard/team", label: "Team" },
  { href: "/dashboard/staff", label: "Staff" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [role, setRole] = useState<"owner" | "staff" | null>(null);
  const [mobileAccountMenuOpen, setMobileAccountMenuOpen] = useState(false);

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
          setRole(user.role);
        }
      })
      .catch(() => {
        // A 401 here already redirects to /login via lib/api.ts.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = role === "owner" ? [...BASE_NAV_ITEMS, ...OWNER_NAV_ITEMS] : BASE_NAV_ITEMS;

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
        {navItems.map((item) => {
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
        <>
          <div className={styles.account}>
            <p className={styles.accountEmail}>{userEmail}</p>
            <Link href="/dashboard/account" className={styles.logout}>
              Change password
            </Link>
            <button type="button" className={styles.logout} onClick={handleLogout}>
              Log out
            </button>
          </div>
          <div className={styles.mobileAccountContainer}>
            <button
              type="button"
              className={styles.mobileAccountButton}
              onClick={() => setMobileAccountMenuOpen(!mobileAccountMenuOpen)}
            >
              Account
            </button>
            {mobileAccountMenuOpen && (
              <div className={styles.mobileAccountMenu}>
                <Link
                  href="/dashboard/account"
                  className={styles.mobileMenuItem}
                  onClick={() => setMobileAccountMenuOpen(false)}
                >
                  Change password
                </Link>
                <button
                  type="button"
                  className={styles.mobileMenuItem}
                  onClick={() => {
                    setMobileAccountMenuOpen(false);
                    handleLogout();
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </nav>
  );
}
