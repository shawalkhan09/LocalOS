"use client";

import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { ApiRequestError, createService, deleteService, getCatalog, getMe, updateService } from "@/lib/api";
import { useToast } from "@/components/Toast";
import tableStyles from "@/components/DataTable.module.css";
import formStyles from "@/components/FormField.module.css";
import { Button, Card, Input } from "@/components";
import pageStyles from "../page.module.css";
import styles from "./page.module.css";

type ServiceItem = ClientConfig["services"][number];

type EditState = {
  serviceId: string;
  name: string;
  description: string;
  durationMinutes: string;
  price: string;
  category: string;
  staffIds: string;
};

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export default function ServicesPage() {
  const { showToast } = useToast();

  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newStaffIds, setNewStaffIds] = useState("");

  function load() {
    Promise.all([getCatalog(), getMe()])
      .then(([catalogRes, meRes]) => {
        // Same defense-in-depth reasoning as the Staff page: the Services
        // nav link is hidden for staff logins, but a staff user navigating
        // here directly by URL would otherwise see the full management UI,
        // even though every mutation (POST/PATCH/DELETE /services) is
        // requireOwner-gated server-side and 403s regardless. GET /catalog
        // is public by design, so there's no request here that naturally
        // 403s — checking role directly is what stands in for that.
        if (meRes.role !== "owner") {
          setForbidden(true);
          return;
        }
        setConfig(catalogRes);
      })
      .catch((err) => {
        setLoadError(err instanceof ApiRequestError ? err.message : "Could not load services.");
      });
  }

  useEffect(load, []);

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createService({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        durationMinutes: Number(newDuration),
        price: Number(newPrice),
        category: newCategory.trim() || undefined,
        staffIds: parseCommaList(newStaffIds).length > 0 ? parseCommaList(newStaffIds) : undefined,
      });
      showToast("Service added.", "success");
      setNewName("");
      setNewDescription("");
      setNewDuration("");
      setNewPrice("");
      setNewCategory("");
      setNewStaffIds("");
      load();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not add the service.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(service: ServiceItem) {
    setEditing({
      serviceId: service.id,
      name: service.name,
      description: service.description ?? "",
      durationMinutes: String(service.durationMinutes),
      price: String(service.price),
      category: service.category ?? "",
      staffIds: service.staffIds?.join(", ") ?? "",
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) {
      return;
    }
    setSubmitting(true);
    try {
      const staffIds = parseCommaList(editing.staffIds);
      await updateService(editing.serviceId, {
        name: editing.name.trim(),
        description: editing.description.trim() || undefined,
        durationMinutes: Number(editing.durationMinutes),
        price: Number(editing.price),
        category: editing.category.trim() || undefined,
        staffIds: staffIds.length > 0 ? staffIds : undefined,
      });
      showToast("Service updated.", "success");
      setEditing(null);
      load();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not save the change.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(service: ServiceItem) {
    if (!confirm(`Delete "${service.name}"? This can't be undone.`)) {
      return;
    }
    try {
      await deleteService(service.id);
      showToast("Service deleted.", "success");
      load();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not delete the service.", "error");
    }
  }

  if (forbidden) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Services</h1>
        <p className={`${pageStyles.error} ${pageStyles.section}`}>Only the account owner can manage services.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Services</h1>
        <p className={`${pageStyles.error} ${pageStyles.section}`}>{loadError}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Services</h1>
      </div>
    );
  }

  return (
    <div>
      <h1 className={pageStyles.heading}>Services</h1>
      <p className={pageStyles.subheading}>{config.services.length} services</p>

      <Card className={`${pageStyles.panel} ${pageStyles.section}`}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Duration</th>
              <th>Price</th>
              <th>Category</th>
              <th>Qualified staff</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {config.services.length === 0 ? (
              <tr>
                <td colSpan={6} className={tableStyles.empty}>
                  No services yet.
                </td>
              </tr>
            ) : (
              config.services.map((service) => (
                <tr key={service.id}>
                  <td>{service.name}</td>
                  <td>{service.durationMinutes} min</td>
                  <td>${service.price}</td>
                  <td>{service.category ?? "—"}</td>
                  <td className={service.staffIds?.length ? undefined : styles.qualifiedAny}>
                    {service.staffIds?.length ? service.staffIds.join(", ") : "Any staff"}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button type="button" className={styles.actionLink} onClick={() => startEdit(service)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.deleteLink}
                        onClick={() => handleDelete(service)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {editing && (
        <div className={pageStyles.section}>
          <h2 className={pageStyles.sectionTitle}>Edit {editing.name || "service"}</h2>
          <form className={formStyles.form} onSubmit={handleEditSubmit}>
            <div className={formStyles.field}>
              <label htmlFor="edit-service-name">Name</label>
              <Input
                id="edit-service-name"
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor="edit-service-description">Description</label>
              <Input
                id="edit-service-description"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor="edit-service-duration">Duration (minutes)</label>
              <Input
                id="edit-service-duration"
                type="number"
                min="1"
                required
                value={editing.durationMinutes}
                onChange={(e) => setEditing({ ...editing, durationMinutes: e.target.value })}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor="edit-service-price">Price</label>
              <Input
                id="edit-service-price"
                type="number"
                min="0"
                step="0.01"
                required
                value={editing.price}
                onChange={(e) => setEditing({ ...editing, price: e.target.value })}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor="edit-service-category">Category</label>
              <Input
                id="edit-service-category"
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor="edit-service-staff">Qualified staff ids (comma-separated, blank = any)</label>
              <Input
                id="edit-service-staff"
                value={editing.staffIds}
                onChange={(e) => setEditing({ ...editing, staffIds: e.target.value })}
              />
            </div>
            <div className={styles.formActions}>
              <Button type="submit" className={formStyles.submit} disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </Button>
              <button type="button" className={styles.cancelLink} onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={pageStyles.section}>
        <h2 className={pageStyles.sectionTitle}>Add a service</h2>
        <form className={formStyles.form} onSubmit={handleAddService}>
          <div className={formStyles.field}>
            <label htmlFor="new-service-name">Name</label>
            <Input id="new-service-name" required value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-service-description">Description (optional)</label>
            <Input
              id="new-service-description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-service-duration">Duration (minutes)</label>
            <Input
              id="new-service-duration"
              type="number"
              min="1"
              required
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-service-price">Price</label>
            <Input
              id="new-service-price"
              type="number"
              min="0"
              step="0.01"
              required
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-service-category">Category (optional)</label>
            <Input
              id="new-service-category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-service-staff">Qualified staff ids (optional, comma-separated)</label>
            <Input id="new-service-staff" value={newStaffIds} onChange={(e) => setNewStaffIds(e.target.value)} />
          </div>
          <Button type="submit" className={formStyles.submit} disabled={submitting}>
            {submitting ? "Adding…" : "Add service"}
          </Button>
        </form>
      </div>
    </div>
  );
}
