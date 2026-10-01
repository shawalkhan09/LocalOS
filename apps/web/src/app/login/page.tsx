"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError, getCatalog, login } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Button, Input } from "@/components";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [businessName, setBusinessName] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // /catalog is a public route — fine to call before signing in.
    getCatalog()
      .then((config) => setBusinessName(config.business.name))
      .catch(() => {
        // Login still works without the business name; it's a nice-to-have.
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not sign in. Try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9v6M8 6v12M16 6v12M20 9v6M8 12h8" />
            </svg>
          </span>
          {businessName && <span className={styles.businessName}>{businessName}</span>}
        </div>
        <div className={styles.main}>
          <div className={styles.intro}>
            <h1 className={styles.heading}>Welcome back.</h1>
            <p className={styles.sub}>Sign in to manage bookings, classes and your team.</p>
          </div>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="password">Password</label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className={styles.submit} disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
        <p className={styles.footer}>Staff and owner access only.</p>
      </div>
      <div className={styles.photo}>
        <span className={styles.badge}>Owner dashboard</span>
      </div>
    </div>
  );
}
