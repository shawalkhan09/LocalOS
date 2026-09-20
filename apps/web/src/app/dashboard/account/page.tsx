"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiRequestError, changePassword } from "@/lib/api";
import { useToast } from "@/components/Toast";
import formStyles from "@/components/FormField.module.css";
import pageStyles from "../page.module.css";

export default function AccountPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMismatch(false);

    if (newPassword !== confirmPassword) {
      setPasswordMismatch(true);
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      showToast(
        "Password changed. You're still logged in here; any other device you're logged in on has been signed out.",
        "success",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        showToast("Current password is incorrect.", "error");
      } else {
        showToast(err instanceof ApiRequestError ? err.message : "Could not change password.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className={pageStyles.heading}>Account</h1>

      <div className={pageStyles.section}>
        <h2 className={pageStyles.sectionTitle}>Change password</h2>
        <form className={formStyles.form} onSubmit={handleSubmit}>
          <div className={formStyles.field}>
            <label htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {passwordMismatch && (
              <p style={{ color: "var(--color-error)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                Passwords do not match
              </p>
            )}
          </div>
          <button type="submit" className={formStyles.submit} disabled={submitting || passwordMismatch}>
            {submitting ? "Changing…" : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}
