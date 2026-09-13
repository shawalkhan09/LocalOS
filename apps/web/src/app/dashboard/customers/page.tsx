"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiRequestError, type Customer, getCustomers } from "@/lib/api";
import tableStyles from "@/components/DataTable.module.css";
import pageStyles from "../page.module.css";

type SortKey = "name" | "email" | "phone" | "createdAt";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCustomers()
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
  }, []);

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

  return (
    <div>
      <h1 className={pageStyles.heading}>Customers</h1>
      <p className={pageStyles.subheading}>{customers.length} total</p>

      {error && <p className={`${pageStyles.error} ${pageStyles.section}`}>{error}</p>}

      <div className={`${pageStyles.panel} ${pageStyles.section}`}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              {sortHeader("name", "Name")}
              {sortHeader("email", "Email")}
              {sortHeader("phone", "Phone")}
              {sortHeader("createdAt", "Added")}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className={tableStyles.empty}>
                  No customers yet.
                </td>
              </tr>
            ) : (
              sorted.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.email ?? "—"}</td>
                  <td>{c.phone ?? "—"}</td>
                  <td>
                    {new Date(c.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
