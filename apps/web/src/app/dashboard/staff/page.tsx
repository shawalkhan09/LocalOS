"use client";

import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import {
  ApiRequestError,
  createStaff,
  createTrainerProfile,
  getCatalog,
  getMe,
  updateStaff,
  updateTrainerProfile,
} from "@/lib/api";
import { useToast } from "@/components/Toast";
import tableStyles from "@/components/DataTable.module.css";
import formStyles from "@/components/FormField.module.css";
import pageStyles from "../page.module.css";
import styles from "./page.module.css";

type StaffMember = ClientConfig["staff"][number];
type TrainerProfile = ClientConfig["trainers"][number];

type EditState =
  | { kind: "staff"; staffId: string; name: string; role: string; email: string; phone: string; bio: string }
  | {
      kind: "trainerProfile";
      staffId: string;
      staffName: string;
      isNew: boolean;
      specialties: string;
      certifications: string;
      bio: string;
      photoUrl: string;
    };

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export default function StaffPage() {
  const { showToast } = useToast();

  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  function load() {
    Promise.all([getCatalog(), getMe()])
      .then(([catalogRes, meRes]) => {
        // Defense in depth: the Staff nav link is hidden for staff logins,
        // but a staff user who navigates here directly by URL would
        // otherwise see the full management UI, even though every mutation
        // (POST/PATCH /staff, POST/PATCH /staff/:id/trainer-profile) is
        // requireOwner-gated server-side and 403s regardless. Unlike
        // Team's GET /users, GET /catalog is public by design, so there's
        // no request here that naturally 403s — checking role directly is
        // what stands in for that.
        if (meRes.role !== "owner") {
          setForbidden(true);
          return;
        }
        setConfig(catalogRes);
      })
      .catch((err) => {
        setLoadError(err instanceof ApiRequestError ? err.message : "Could not load staff.");
      });
  }

  useEffect(load, []);

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createStaff({
        name: newName.trim(),
        role: newRole.trim(),
        email: newEmail.trim() || undefined,
        phone: newPhone.trim() || undefined,
      });
      showToast("Staff member added.", "success");
      setNewName("");
      setNewRole("");
      setNewEmail("");
      setNewPhone("");
      load();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not add the staff member.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditStaff(member: StaffMember) {
    setEditing({
      kind: "staff",
      staffId: member.id,
      name: member.name,
      role: member.role,
      email: member.email ?? "",
      phone: member.phone ?? "",
      bio: member.bio ?? "",
    });
  }

  function startTrainerProfile(member: StaffMember, existing: TrainerProfile | undefined) {
    setEditing({
      kind: "trainerProfile",
      staffId: member.id,
      staffName: member.name,
      isNew: !existing,
      specialties: existing?.specialties?.join(", ") ?? "",
      certifications: existing?.certifications?.join(", ") ?? "",
      bio: existing?.bio ?? "",
      photoUrl: existing?.photoUrl ?? "",
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) {
      return;
    }
    setSubmitting(true);
    try {
      if (editing.kind === "staff") {
        await updateStaff(editing.staffId, {
          name: editing.name.trim(),
          role: editing.role.trim(),
          email: editing.email.trim() || undefined,
          phone: editing.phone.trim() || undefined,
          bio: editing.bio.trim() || undefined,
        });
        showToast("Staff member updated.", "success");
      } else {
        const data = {
          specialties: parseCommaList(editing.specialties),
          certifications: parseCommaList(editing.certifications),
          bio: editing.bio.trim() || undefined,
          photoUrl: editing.photoUrl.trim() || undefined,
        };
        if (editing.isNew) {
          await createTrainerProfile(editing.staffId, data);
          showToast("Trainer profile added.", "success");
        } else {
          await updateTrainerProfile(editing.staffId, data);
          showToast("Trainer profile updated.", "success");
        }
      }
      setEditing(null);
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        showToast("This staff member already has a trainer profile.", "error");
      } else {
        showToast(err instanceof ApiRequestError ? err.message : "Could not save the change.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (forbidden) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Staff</h1>
        <p className={`${pageStyles.error} ${pageStyles.section}`}>Only the account owner can manage staff.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Staff</h1>
        <p className={`${pageStyles.error} ${pageStyles.section}`}>{loadError}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Staff</h1>
      </div>
    );
  }

  const trainerByStaffId = new Map(config.trainers.map((t) => [t.staffId, t]));

  return (
    <div>
      <h1 className={pageStyles.heading}>Staff</h1>
      <p className={pageStyles.subheading}>{config.staff.length} staff members</p>

      <div className={`${pageStyles.panel} ${pageStyles.section}`}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Trainer profile</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {config.staff.length === 0 ? (
              <tr>
                <td colSpan={6} className={tableStyles.empty}>
                  No staff yet.
                </td>
              </tr>
            ) : (
              config.staff.map((member) => {
                const trainerProfile = trainerByStaffId.get(member.id);
                return (
                  <tr key={member.id}>
                    <td>{member.name}</td>
                    <td>{member.role}</td>
                    <td>{member.email ?? "—"}</td>
                    <td>{member.phone ?? "—"}</td>
                    <td className={trainerProfile ? undefined : styles.trainerNo}>
                      {trainerProfile ? "Yes" : "No"}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button type="button" className={styles.actionLink} onClick={() => startEditStaff(member)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.actionLink}
                          onClick={() => startTrainerProfile(member, trainerProfile)}
                        >
                          {trainerProfile ? "Edit trainer profile" : "Add trainer profile"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className={pageStyles.section}>
          <h2 className={pageStyles.sectionTitle}>
            {editing.kind === "staff"
              ? `Edit ${editing.name || "staff member"}`
              : `${editing.isNew ? "Add" : "Edit"} trainer profile: ${editing.staffName}`}
          </h2>
          <form className={formStyles.form} onSubmit={handleEditSubmit}>
            {editing.kind === "staff" ? (
              <>
                <div className={formStyles.field}>
                  <label htmlFor="edit-staff-name">Name</label>
                  <input
                    id="edit-staff-name"
                    required
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div className={formStyles.field}>
                  <label htmlFor="edit-staff-role">Role</label>
                  <input
                    id="edit-staff-role"
                    required
                    value={editing.role}
                    onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  />
                </div>
                <div className={formStyles.field}>
                  <label htmlFor="edit-staff-email">Email</label>
                  <input
                    id="edit-staff-email"
                    type="email"
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  />
                </div>
                <div className={formStyles.field}>
                  <label htmlFor="edit-staff-phone">Phone</label>
                  <input
                    id="edit-staff-phone"
                    value={editing.phone}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  />
                </div>
                <div className={formStyles.field}>
                  <label htmlFor="edit-staff-bio">Bio</label>
                  <input
                    id="edit-staff-bio"
                    value={editing.bio}
                    onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <>
                <div className={formStyles.field}>
                  <label htmlFor="edit-trainer-specialties">Specialties (comma-separated)</label>
                  <input
                    id="edit-trainer-specialties"
                    value={editing.specialties}
                    onChange={(e) => setEditing({ ...editing, specialties: e.target.value })}
                  />
                </div>
                <div className={formStyles.field}>
                  <label htmlFor="edit-trainer-certifications">Certifications (comma-separated)</label>
                  <input
                    id="edit-trainer-certifications"
                    value={editing.certifications}
                    onChange={(e) => setEditing({ ...editing, certifications: e.target.value })}
                  />
                </div>
                <div className={formStyles.field}>
                  <label htmlFor="edit-trainer-bio">Bio</label>
                  <input
                    id="edit-trainer-bio"
                    value={editing.bio}
                    onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
                  />
                </div>
                <div className={formStyles.field}>
                  <label htmlFor="edit-trainer-photo">Photo URL</label>
                  <input
                    id="edit-trainer-photo"
                    type="url"
                    value={editing.photoUrl}
                    onChange={(e) => setEditing({ ...editing, photoUrl: e.target.value })}
                  />
                </div>
              </>
            )}
            <div className={styles.formActions}>
              <button type="submit" className={formStyles.submit} disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </button>
              <button type="button" className={styles.cancelLink} onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={pageStyles.section}>
        <h2 className={pageStyles.sectionTitle}>Add a staff member</h2>
        <form className={formStyles.form} onSubmit={handleAddStaff}>
          <div className={formStyles.field}>
            <label htmlFor="new-staff-name">Name</label>
            <input id="new-staff-name" required value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-staff-role">Role</label>
            <input id="new-staff-role" required value={newRole} onChange={(e) => setNewRole(e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-staff-email">Email (optional)</label>
            <input
              id="new-staff-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-staff-phone">Phone (optional)</label>
            <input id="new-staff-phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </div>
          <button type="submit" className={formStyles.submit} disabled={submitting}>
            {submitting ? "Adding…" : "Add staff member"}
          </button>
        </form>
      </div>
    </div>
  );
}
