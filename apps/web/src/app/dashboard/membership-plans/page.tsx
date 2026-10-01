"use client";

import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import {
  ApiRequestError,
  createMembershipPlan,
  deleteMembershipPlan,
  getCatalog,
  getMe,
  updateMembershipPlan,
} from "@/lib/api";
import { useToast } from "@/components/Toast";
import tableStyles from "@/components/DataTable.module.css";
import formStyles from "@/components/FormField.module.css";
import { Button, Card, Input, PageHeader } from "@/components";
import m from "../manage.module.css";
import styles from "./page.module.css";

type MembershipPlanItem = ClientConfig["membershipPlans"][number];
type BillingInterval = MembershipPlanItem["billingInterval"];

const BILLING_INTERVALS: BillingInterval[] = ["monthly", "annual", "week", "day"];

type EditState = {
  planId: string;
  name: string;
  price: string;
  billingInterval: BillingInterval;
  description: string;
  perks: string;
};

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export default function MembershipPlansPage() {
  const { showToast } = useToast();

  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newBillingInterval, setNewBillingInterval] = useState<BillingInterval>("monthly");
  const [newDescription, setNewDescription] = useState("");
  const [newPerks, setNewPerks] = useState("");

  function load() {
    Promise.all([getCatalog(), getMe()])
      .then(([catalogRes, meRes]) => {
        // Same defense-in-depth reasoning as the Services page: the
        // Membership plans nav link is hidden for staff logins, but a
        // staff user navigating here directly by URL would otherwise see
        // the full management UI, even though every mutation
        // (POST/PATCH/DELETE /membership-plans) is requireOwner-gated
        // server-side and 403s regardless. GET /catalog is public by
        // design, so there's no request here that naturally 403s —
        // checking role directly is what stands in for that.
        if (meRes.role !== "owner") {
          setForbidden(true);
          return;
        }
        setConfig(catalogRes);
      })
      .catch((err) => {
        setLoadError(err instanceof ApiRequestError ? err.message : "Could not load membership plans.");
      });
  }

  useEffect(load, []);

  async function handleAddPlan(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createMembershipPlan({
        name: newName.trim(),
        price: Number(newPrice),
        billingInterval: newBillingInterval,
        description: newDescription.trim() || undefined,
        perks: parseCommaList(newPerks).length > 0 ? parseCommaList(newPerks) : undefined,
      });
      showToast("Membership plan added.", "success");
      setNewName("");
      setNewPrice("");
      setNewBillingInterval("monthly");
      setNewDescription("");
      setNewPerks("");
      load();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not add the membership plan.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(plan: MembershipPlanItem) {
    setEditing({
      planId: plan.id,
      name: plan.name,
      price: String(plan.price),
      billingInterval: plan.billingInterval,
      description: plan.description ?? "",
      perks: plan.perks?.join(", ") ?? "",
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) {
      return;
    }
    setSubmitting(true);
    try {
      const perks = parseCommaList(editing.perks);
      await updateMembershipPlan(editing.planId, {
        name: editing.name.trim(),
        price: Number(editing.price),
        billingInterval: editing.billingInterval,
        description: editing.description.trim() || undefined,
        perks: perks.length > 0 ? perks : undefined,
      });
      showToast("Membership plan updated.", "success");
      setEditing(null);
      load();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not save the change.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(plan: MembershipPlanItem) {
    if (!confirm(`Delete "${plan.name}"? This can't be undone.`)) {
      return;
    }
    try {
      await deleteMembershipPlan(plan.id);
      showToast("Membership plan deleted.", "success");
      load();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not delete the membership plan.", "error");
    }
  }

  if (forbidden) {
    return (
      <div>
        <PageHeader eyebrow="Manage" title="Membership plans" />
        <p className={`${m.error} ${m.section}`}>
          Only the account owner can manage membership plans.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader eyebrow="Manage" title="Membership plans" />
        <p className={`${m.error} ${m.section}`}>{loadError}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div>
        <PageHeader eyebrow="Manage" title="Membership plans" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Manage" title="Membership plans" />
      <p className={m.sub}>{config.membershipPlans.length} plans</p>

      <Card className={`${tableStyles.tableCard} ${m.tableCard} ${m.section}`}>
        <div className={tableStyles.tableWrap}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Price</th>
              <th>Billing</th>
              <th>Description</th>
              <th>Perks</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {config.membershipPlans.length === 0 ? (
              <tr>
                <td colSpan={6} className={tableStyles.empty}>
                  No membership plans yet.
                </td>
              </tr>
            ) : (
              config.membershipPlans.map((plan) => (
                <tr key={plan.id}>
                  <td>{plan.name}</td>
                  <td>${plan.price}</td>
                  <td>{plan.billingInterval}</td>
                  <td>{plan.description ?? "—"}</td>
                  <td>{plan.perks?.length ? plan.perks.join(", ") : "—"}</td>
                  <td>
                    <div className={styles.actions}>
                      <button type="button" className={styles.actionLink} onClick={() => startEdit(plan)}>
                        Edit
                      </button>
                      <button type="button" className={styles.deleteLink} onClick={() => handleDelete(plan)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </Card>

      {editing && (
        <div className={`${m.formCard} ${m.section}`}>
          <h2 className={m.sectionTitle}>Edit {editing.name || "plan"}</h2>
          <form className={`${formStyles.form} ${m.grid}`} onSubmit={handleEditSubmit}>
            <div className={formStyles.field}>
              <label htmlFor="edit-plan-name">Name</label>
              <Input
                id="edit-plan-name"
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor="edit-plan-price">Price</label>
              <Input
                id="edit-plan-price"
                type="number"
                min="0"
                step="0.01"
                required
                value={editing.price}
                onChange={(e) => setEditing({ ...editing, price: e.target.value })}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor="edit-plan-billing">Billing interval</label>
              <select
                id="edit-plan-billing"
                value={editing.billingInterval}
                onChange={(e) => setEditing({ ...editing, billingInterval: e.target.value as BillingInterval })}
              >
                {BILLING_INTERVALS.map((interval) => (
                  <option key={interval} value={interval}>
                    {interval}
                  </option>
                ))}
              </select>
            </div>
            <div className={formStyles.field}>
              <label htmlFor="edit-plan-description">Description</label>
              <Input
                id="edit-plan-description"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor="edit-plan-perks">Perks (comma-separated)</label>
              <Input
                id="edit-plan-perks"
                value={editing.perks}
                onChange={(e) => setEditing({ ...editing, perks: e.target.value })}
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

      <div className={`${m.formCard} ${m.section}`}>
        <h2 className={m.sectionTitle}>Add a membership plan</h2>
        <form className={`${formStyles.form} ${m.grid}`} onSubmit={handleAddPlan}>
          <div className={formStyles.field}>
            <label htmlFor="new-plan-name">Name</label>
            <Input id="new-plan-name" required value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-plan-price">Price</label>
            <Input
              id="new-plan-price"
              type="number"
              min="0"
              step="0.01"
              required
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-plan-billing">Billing interval</label>
            <select
              id="new-plan-billing"
              value={newBillingInterval}
              onChange={(e) => setNewBillingInterval(e.target.value as BillingInterval)}
            >
              {BILLING_INTERVALS.map((interval) => (
                <option key={interval} value={interval}>
                  {interval}
                </option>
              ))}
            </select>
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-plan-description">Description (optional)</label>
            <Input
              id="new-plan-description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-plan-perks">Perks (optional, comma-separated)</label>
            <Input id="new-plan-perks" value={newPerks} onChange={(e) => setNewPerks(e.target.value)} />
          </div>
          <Button type="submit" className={formStyles.submit} disabled={submitting}>
            {submitting ? "Adding…" : "Add plan"}
          </Button>
        </form>
      </div>
    </div>
  );
}
