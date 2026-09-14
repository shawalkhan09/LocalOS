"use client";

import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { type Account, ApiRequestError, createUser, getCatalog, getUsers } from "@/lib/api";
import { useToast } from "@/components/Toast";
import tableStyles from "@/components/DataTable.module.css";
import formStyles from "@/components/FormField.module.css";
import pageStyles from "../page.module.css";

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export default function TeamPage() {
  const { showToast } = useToast();

  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffId, setStaffId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    Promise.all([getCatalog(), getUsers()])
      .then(([catalogRes, accountsRes]) => {
        setConfig(catalogRes);
        setAccounts(accountsRes);
      })
      .catch((err) => {
        // Defense in depth: the Team nav link is hidden for staff, but a
        // staff user who navigates here directly by URL still hits GET
        // /users, which 403s. That's the real boundary (see requireOwner
        // in apps/api/src/auth/middleware.ts) — this just renders it as a
        // clear message instead of a broken page.
        if (err instanceof ApiRequestError && err.status === 403) {
          setForbidden(true);
          return;
        }
        setLoadError(err instanceof ApiRequestError ? err.message : "Could not load the team.");
      });
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createUser({ email: email.trim(), password, staffId: staffId || undefined });
      showToast("Staff account created.", "success");
      setEmail("");
      setPassword("");
      setStaffId("");
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        showToast("An account with that email already exists.", "error");
      } else {
        showToast(err instanceof ApiRequestError ? err.message : "Could not create the account.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (forbidden) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Team</h1>
        <p className={`${pageStyles.error} ${pageStyles.section}`}>
          Only the account owner can manage the team.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Team</h1>
        <p className={`${pageStyles.error} ${pageStyles.section}`}>{loadError}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Team</h1>
      </div>
    );
  }

  const staffById = new Map(config.staff.map((s) => [s.id, s]));

  return (
    <div>
      <h1 className={pageStyles.heading}>Team</h1>
      <p className={pageStyles.subheading}>{accounts.length} dashboard accounts</p>

      <div className={`${pageStyles.panel} ${pageStyles.section}`}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Staff member</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={3} className={tableStyles.empty}>
                  No accounts yet.
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.email}</td>
                  <td>{capitalize(a.role)}</td>
                  <td>{a.staffId ? (staffById.get(a.staffId)?.name ?? a.staffId) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={pageStyles.section}>
        <h2 className={pageStyles.sectionTitle}>Add a staff account</h2>
        <form className={formStyles.form} onSubmit={handleSubmit}>
          <div className={formStyles.field}>
            <label htmlFor="team-email">Email</label>
            <input
              id="team-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="team-password">Password</label>
            <input
              id="team-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="team-staff">Staff member (optional)</label>
            <select id="team-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Not linked to a specific staff member</option>
              {config.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={formStyles.submit} disabled={submitting}>
            {submitting ? "Adding…" : "Add staff account"}
          </button>
        </form>
      </div>
    </div>
  );
}
