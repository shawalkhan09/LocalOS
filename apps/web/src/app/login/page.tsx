"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError, getCatalog, login } from "@/lib/api";
import { useToast } from "@/components/Toast";
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
        {businessName && <p className={styles.businessName}>{businessName}</p>}
        <h1 className={styles.heading}>Sign in</h1>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
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
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
