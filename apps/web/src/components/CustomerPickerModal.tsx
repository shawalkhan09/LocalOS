"use client";

import { useMemo, useState } from "react";
import { ApiRequestError, type Customer, createCustomer } from "@/lib/api";
import { Modal } from "./Modal";
import styles from "./CustomerPickerModal.module.css";

export function CustomerPickerModal({
  customers,
  onClose,
  onPick,
}: {
  customers: Customer[];
  onClose: () => void;
  onPick: (customer: Customer) => void;
}) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return customers.slice(0, 20);
    }
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      .slice(0, 20);
  }, [customers, query]);

  async function handleCreate() {
    setCreateError(null);
    if (!name.trim()) {
      setCreateError("Name is required.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setCreateError("Enter an email or phone number.");
      return;
    }
    setCreating(true);
    try {
      const customer = await createCustomer({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      onPick(customer);
    } catch (err) {
      setCreateError(err instanceof ApiRequestError ? err.message : "Could not create customer.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal title="Find or add a customer" onClose={onClose}>
      <input
        type="text"
        className={styles.search}
        placeholder="Search by name or email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className={styles.results}>
        {results.length === 0 ? (
          <p className={styles.empty}>No matches.</p>
        ) : (
          results.map((c) => (
            <button key={c.id} type="button" className={styles.resultRow} onClick={() => onPick(c)}>
              <div className={styles.resultName}>{c.name}</div>
              <div className={styles.resultMeta}>{c.email ?? c.phone ?? ""}</div>
            </button>
          ))
        )}
      </div>

      <div className={styles.divider}>or add new</div>

      <div className={styles.field}>
        <label htmlFor="new-customer-name">Name</label>
        <input id="new-customer-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label htmlFor="new-customer-email">Email</label>
        <input id="new-customer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label htmlFor="new-customer-phone">Phone</label>
        <input id="new-customer-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      {createError && <p className={styles.formError}>{createError}</p>}
      <button type="button" className={styles.createButton} onClick={handleCreate} disabled={creating}>
        {creating ? "Adding…" : "Add customer"}
      </button>
    </Modal>
  );
}
