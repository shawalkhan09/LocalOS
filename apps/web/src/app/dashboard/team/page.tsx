"use client";

import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { type Account, ApiRequestError, createUser, getCatalog, getMe, getUsers, updateUser, resetPassword } from "@/lib/api";
import { useToast } from "@/components/Toast";
import tableStyles from "@/components/DataTable.module.css";
import formStyles from "@/components/FormField.module.css";
import pageStyles from "../page.module.css";
import styles from "./page.module.css";

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export default function TeamPage() {
  const { showToast } = useToast();

  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffId, setStaffId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingEmailId, setEditingEmailId] = useState<number | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [resetPasswordId, setResetPasswordId] = useState<number | null>(null);
  const [resetPasswordDraft, setResetPasswordDraft] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  function load() {
    Promise.all([getCatalog(), getUsers(), getMe()])
      .then(([catalogRes, accountsRes, meRes]) => {
        setConfig(catalogRes);
        setAccounts(accountsRes);
        setCurrentUserId(meRes.id);
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

  function startEditEmail(account: Account) {
    setEditingEmailId(account.id);
    setEmailDraft(account.email);
  }

  function cancelEditEmail() {
    setEditingEmailId(null);
    setEmailDraft("");
  }

  async function handleSaveEmail(account: Account) {
    const trimmed = emailDraft.trim();
    if (trimmed === account.email) {
      cancelEditEmail();
      return;
    }
    setSavingEmail(true);
    try {
      const updated = await updateUser(account.id, { email: trimmed });
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      showToast("Email updated.", "success");
      cancelEditEmail();
    } catch (err) {
      // Same friendly wording as the create-account flow above — a
      // duplicate email is a common, expected mistake here, not a raw
      // constraint to surface.
      if (err instanceof ApiRequestError && err.status === 409) {
        showToast("An account with that email already exists.", "error");
      } else {
        showToast(err instanceof ApiRequestError ? err.message : "Could not update the email.", "error");
      }
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleStaffLinkChange(account: Account, newStaffId: string) {
    try {
      const updated = await updateUser(account.id, { staffId: newStaffId || null });
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      showToast("Staff link updated.", "success");
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not update the account.", "error");
    }
  }

  async function handleToggleStatus(account: Account) {
    const nextStatus = account.status === "active" ? "deactivated" : "active";
    // Deactivating signs someone out immediately (see apps/api's
    // PATCH /users/:id) — worth one beat of confirmation before doing it.
    // Reactivating isn't destructive, so it doesn't need the same pause.
    if (nextStatus === "deactivated") {
      const confirmed = window.confirm(
        `Deactivate ${account.email}? This immediately signs them out and blocks logging back in until reactivated.`,
      );
      if (!confirmed) {
        return;
      }
    }
    try {
      const updated = await updateUser(account.id, { status: nextStatus });
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      showToast(nextStatus === "deactivated" ? "Account deactivated." : "Account reactivated.", "success");
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not update the account.", "error");
    }
  }

  function startResetPassword(account: Account) {
    setResetPasswordId(account.id);
    setResetPasswordDraft("");
  }

  function cancelResetPassword() {
    setResetPasswordId(null);
    setResetPasswordDraft("");
  }

  async function handleSaveResetPassword(account: Account) {
    const newPassword = resetPasswordDraft.trim();
    if (!newPassword) {
      showToast("Password cannot be empty.", "error");
      return;
    }
    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters.", "error");
      return;
    }
    setResettingPassword(true);
    try {
      await resetPassword(account.id, newPassword);
      showToast("Password reset. This account has been signed out.", "success");
      cancelResetPassword();
      load();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not reset the password.", "error");
    } finally {
      setResettingPassword(false);
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
              <th>Status</th>
              <th>Staff member</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className={tableStyles.empty}>
                  No accounts yet.
                </td>
              </tr>
            ) : (
              accounts.map((a) => {
                const isSelf = a.id === currentUserId;
                const isDeactivated = a.status === "deactivated";
                const isEditingEmail = editingEmailId === a.id;
                const isResetingPassword = resetPasswordId === a.id;
                return (
                  <tr key={a.id} className={isDeactivated ? styles.deactivatedRow : ""}>
                    <td>
                      {isEditingEmail ? (
                        <div className={styles.emailCell}>
                          <input
                            type="email"
                            className={styles.inlineInput}
                            value={emailDraft}
                            onChange={(e) => setEmailDraft(e.target.value)}
                            aria-label={`New email for ${a.email}`}
                            autoFocus
                          />
                          <button
                            type="button"
                            className={styles.actionLink}
                            disabled={savingEmail}
                            onClick={() => handleSaveEmail(a)}
                          >
                            {savingEmail ? "Saving…" : "Save"}
                          </button>
                          <button type="button" className={styles.cancelLink} onClick={cancelEditEmail}>
                            Cancel
                          </button>
                        </div>
                      ) : isResetingPassword ? (
                        <div className={styles.emailCell}>
                          <input
                            type="password"
                            className={styles.inlineInput}
                            placeholder="New password (min 8 characters)"
                            value={resetPasswordDraft}
                            onChange={(e) => setResetPasswordDraft(e.target.value)}
                            aria-label={`New password for ${a.email}`}
                            autoFocus
                          />
                          <button
                            type="button"
                            className={styles.actionLink}
                            disabled={resettingPassword}
                            onClick={() => handleSaveResetPassword(a)}
                          >
                            {resettingPassword ? "Resetting…" : "Reset"}
                          </button>
                          <button type="button" className={styles.cancelLink} onClick={cancelResetPassword}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className={styles.emailCell}>
                          <span>{a.email}</span>
                          <button type="button" className={styles.actionLink} onClick={() => startEditEmail(a)}>
                            Edit email
                          </button>
                          {!isSelf && (
                            <button type="button" className={styles.actionLink} onClick={() => startResetPassword(a)}>
                              Reset password
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td>{capitalize(a.role)}</td>
                    <td>{capitalize(a.status)}</td>
                    <td>
                      {isSelf ? (
                        a.staffId ? (staffById.get(a.staffId)?.name ?? a.staffId) : "—"
                      ) : (
                        <select
                          className={styles.inlineSelect}
                          value={a.staffId ?? ""}
                          onChange={(e) => handleStaffLinkChange(a, e.target.value)}
                          aria-label={`Staff member linked to ${a.email}`}
                        >
                          <option value="">Not linked</option>
                          {config.staff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      {!isSelf && (
                        <button
                          type="button"
                          className={`${styles.actionLink} ${isDeactivated ? "" : styles.actionLinkWarn}`}
                          onClick={() => handleToggleStatus(a)}
                        >
                          {isDeactivated ? "Reactivate" : "Deactivate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
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
