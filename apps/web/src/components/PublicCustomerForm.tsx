"use client";

import { useState } from "react";
import sharedStyles from "./PublicShared.module.css";

export type PublicCustomerInfo = { name: string; email: string; phone?: string };

export function PublicCustomerForm({
  onSubmit,
  submitting,
  submitLabel,
}: {
  onSubmit: (info: PublicCustomerInfo) => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={sharedStyles.field}>
        <label htmlFor="customer-name">Name</label>
        <input id="customer-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className={sharedStyles.field}>
        <label htmlFor="customer-email">Email</label>
        <input
          id="customer-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className={sharedStyles.field}>
        <label htmlFor="customer-phone">Phone (optional)</label>
        <input id="customer-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <button type="submit" className={sharedStyles.pillButton} disabled={submitting}>
        {submitting ? "Booking…" : submitLabel}
      </button>
    </form>
  );
}
