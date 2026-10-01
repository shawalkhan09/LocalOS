"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiRequestError, type Customer, archiveCustomer, getCustomers, unarchiveCustomer } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import tableStyles from "@/components/DataTable.module.css";
import { Button, Card, PageHeader } from "@/components";
import pageStyles from "../page.module.css";
import styles from "./page.module.css";

type SortKey = "name" | "email" | "phone" | "createdAt";

export default function CustomersPage() {
  const { showToast } = useToast();
  const [view, setView] = useState<"active" | "archived">("active");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const [customerToArchive, setCustomerToArchive] = useState<Customer | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getCustomers(view === "archived")
      .then((rows) => {
        if (!cancelled) {
          setCustomers(rows);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : "Could not load customers.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  const sorted = useMemo(() => {
    const rows = [...customers];
    rows.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = av.localeCompare(bv);
      return sortAsc ? cmp : -cmp;
    });
    return rows;
  }, [customers, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((asc) => !asc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function sortHeader(key: SortKey, label: string) {
    const isActive = sortKey === key;
    return (
      <th>
        <button
          type="button"
          className={`${tableStyles.sortButton} ${isActive ? tableStyles.sortActive : ""}`}
          onClick={() => toggleSort(key)}
          aria-sort={isActive ? (sortAsc ? "ascending" : "descending") : "none"}
        >
          {label}
          {isActive ? (sortAsc ? " ↑" : " ↓") : ""}
        </button>
      </th>
    );
  }

  async function handleConfirmArchive() {
    if (!customerToArchive) return;
    setArchiving(true);
    try {
      await archiveCustomer(customerToArchive.id);
      setCustomers((prev) => prev.filter((c) => c.id !== customerToArchive.id));
      showToast("Customer archived.", "success");
      setCustomerToArchive(null);
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not archive customer.", "error");
    } finally {
      setArchiving(false);
    }
  }

  async function handleUnarchive(customer: Customer) {
    try {
      await unarchiveCustomer(customer.id);
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      showToast("Customer unarchived.", "success");
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not unarchive customer.", "error");
    }
  }

  return (
    <div>
      <PageHeader eyebrow={`${customers.length} ${view === "archived" ? "archived" : "total"}`} title="Customers" />

      <div className={styles.viewToggle}>
        <Button type="button" variant={view === "active" ? "primary" : "secondary"} onClick={() => setView("active")}>
          Active
        </Button>
        <Button
          type="button"
          variant={view === "archived" ? "primary" : "secondary"}
          onClick={() => setView("archived")}
        >
          Archived
        </Button>
      </div>

      {error && <p className={`${pageStyles.error} ${pageStyles.section}`}>{error}</p>}

      <Card className={`${tableStyles.tableCard} ${styles.tableCard} ${pageStyles.section}`}>
        <div className={tableStyles.tableWrap}>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                {sortHeader("name", "Name")}
                {sortHeader("email", "Email")}
                {sortHeader("phone", "Phone")}
                {sortHeader("createdAt", "Added")}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className={tableStyles.empty}>
                    {view === "archived" ? "No archived customers." : "No customers yet."}
                  </td>
                </tr>
              ) : (
                sorted.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.email ?? "—"}</td>
                    <td>{c.phone ?? "—"}</td>
                    <td>
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td>
                      {view === "active" ? (
                        <button
                          type="button"
                          className={`${styles.actionLink} ${styles.actionLinkWarn}`}
                          onClick={() => setCustomerToArchive(c)}
                        >
                          Archive
                        </button>
                      ) : (
                        <button type="button" className={styles.actionLink} onClick={() => handleUnarchive(c)}>
                          Unarchive
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {customerToArchive && (
        <Modal title="Archive customer" onClose={() => setCustomerToArchive(null)}>
          <div className={styles.modalBody}>
            <p className={styles.modalText}>
              Are you sure you want to archive <strong>{customerToArchive.name}</strong>? Their booking history will be
              kept.
            </p>
            <div className={styles.modalActions}>
              <Button type="button" variant="secondary" onClick={() => setCustomerToArchive(null)} disabled={archiving}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={handleConfirmArchive} disabled={archiving}>
                {archiving ? "Archiving…" : "Archive customer"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
