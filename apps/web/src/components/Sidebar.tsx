"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { getCatalog, getMe, logout } from "@/lib/api";
import styles from "./Sidebar.module.css";

// First letter of up to the first two words, for the logo monogram.
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

const BASE_NAV_ITEMS = [
  { href: "/dashboard", label: "Today" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/new-booking", label: "New booking" },
];

// Staff-only nav items — shown only when role === "staff"
const STAFF_NAV_ITEMS = [{ href: "/dashboard/schedule", label: "My schedule" }];

// Team and Staff are appended only for role === "owner" — hiding the links
// is not the actual security boundary (the underlying API routes still
// 403 a staff session regardless), just keeps a staff user from seeing a
// link to a page they can't use. See requireOwner in
// apps/api/src/auth/middleware.ts for the real gate, and /dashboard/team
// and /dashboard/staff for the defense-in-depth 403 handling.
const OWNER_NAV_ITEMS = [
  { href: "/dashboard/team", label: "Team" },
  { href: "/dashboard/staff", label: "Staff" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/classes", label: "Classes" },
  { href: "/dashboard/business-hours", label: "Business hours" },
  { href: "/dashboard/business-info", label: "Business info" },
  { href: "/dashboard/membership-plans", label: "Membership plans" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [role, setRole] = useState<"owner" | "staff" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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

  // Below 900px the nav is a panel opened from the top bar. Close it on
  // route change, and on Escape (returning focus to the menu button).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const navItems =
    role === "owner"
      ? [...BASE_NAV_ITEMS, ...OWNER_NAV_ITEMS]
      : role === "staff"
        ? [...BASE_NAV_ITEMS, ...STAFF_NAV_ITEMS]
        : BASE_NAV_ITEMS;

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.push("/login");
    }
  }

  const manageHrefs = new Set(OWNER_NAV_ITEMS.map((item) => item.href));
  const groups = [
    { label: "Front desk", items: navItems.filter((item) => !manageHrefs.has(item.href)) },
    { label: "Manage", items: navItems.filter((item) => manageHrefs.has(item.href)) },
  ].filter((group) => group.items.length > 0);

  return (
    <nav className={styles.sidebar} aria-label="Main">
      <div className={styles.topBar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9v6M8 6v12M16 6v12M20 9v6M8 12h8" />
            </svg>
          </span>
          <p className={styles.businessName}>{businessName ?? "LocalOS"}</p>
        </div>
        <button
          type="button"
          ref={menuButtonRef}
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="dashboard-nav-panel"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>
      <div
        id="dashboard-nav-panel"
        className={`${styles.panel} ${menuOpen ? styles.panelOpen : ""}`}
      >
        {groups.map((group) => (
          <div key={group.label} className={styles.group}>
            <span className={styles.groupLabel}>{group.label}</span>
            {group.items.map((item) => {
              const isActive = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
        {userEmail && (
          <div className={styles.account}>
            <div className={styles.accountHead}>
              <span className={styles.avatar} aria-hidden="true">
                {getInitials(userEmail.split("@")[0].replace(/[._-]+/g, " "))}
              </span>
              <p className={styles.accountEmail}>{userEmail}</p>
            </div>
            <Link href="/dashboard/account" className={styles.logout} onClick={() => setMenuOpen(false)}>
              Change password
            </Link>
            <button type="button" className={styles.logout} onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
