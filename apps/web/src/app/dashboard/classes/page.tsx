"use client";

import { useEffect, useState } from "react";
import type { ClassScheduleSlot, ClientConfig, Weekday } from "@localos/config-schema";
import { ApiRequestError, createClass, deleteClass, getCatalog, getMe, updateClass } from "@/lib/api";
import { useToast } from "@/components/Toast";
import tableStyles from "@/components/DataTable.module.css";
import formStyles from "@/components/FormField.module.css";
import { Button, Card, Input } from "@/components";
import pageStyles from "../page.module.css";
import styles from "./page.module.css";

type ClassItem = ClientConfig["classes"][number];

const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

type EditState = {
  classId: string;
  name: string;
  trainerId: string;
  durationMinutes: string;
  capacity: string;
  category: string;
  schedule: ClassScheduleSlot[];
};

function emptySlot(): ClassScheduleSlot {
  return { day: "monday", startTime: "09:00" };
}

function ScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: ClassScheduleSlot[];
  onChange: (schedule: ClassScheduleSlot[]) => void;
}) {
  function updateSlot(index: number, slot: ClassScheduleSlot) {
    onChange(schedule.map((s, i) => (i === index ? slot : s)));
  }

  function removeSlot(index: number) {
    onChange(schedule.filter((_, i) => i !== index));
  }

  return (
    <div className={styles.scheduleEditor}>
      {schedule.map((slot, index) => (
        <div key={index} className={styles.scheduleRow}>
          <select
            value={slot.day}
            onChange={(e) => updateSlot(index, { ...slot, day: e.target.value as Weekday })}
          >
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
          <Input
            type="time"
            value={slot.startTime}
            onChange={(e) => updateSlot(index, { ...slot, startTime: e.target.value })}
          />
          <button
            type="button"
            className={styles.deleteLink}
            onClick={() => removeSlot(index)}
            disabled={schedule.length <= 1}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className={styles.actionLink} onClick={() => onChange([...schedule, emptySlot()])}>
        Add day
      </button>
    </div>
  );
}

export default function ClassesPage() {
  const { showToast } = useToast();

  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [newName, setNewName] = useState("");
  const [newTrainerId, setNewTrainerId] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSchedule, setNewSchedule] = useState<ClassScheduleSlot[]>([emptySlot()]);

  function load() {
    Promise.all([getCatalog(), getMe()])
      .then(([catalogRes, meRes]) => {
        // Same defense-in-depth reasoning as the Services page: the Classes
        // nav link is hidden for staff logins, but a staff user navigating
        // here directly by URL would otherwise see the full management UI,
        // even though every mutation (POST/PATCH/DELETE /classes) is
        // requireOwner-gated server-side and 403s regardless.
        if (meRes.role !== "owner") {
          setForbidden(true);
          return;
        }
        setConfig(catalogRes);
        if (catalogRes.trainers.length > 0 && !newTrainerId) {
          setNewTrainerId(catalogRes.trainers[0]!.id);
        }
      })
      .catch((err) => {
        setLoadError(err instanceof ApiRequestError ? err.message : "Could not load classes.");
      });
  }

  useEffect(load, []);

  function trainerLabel(config: ClientConfig, trainerId: string): string {
    const trainer = config.trainers.find((t) => t.id === trainerId);
    const staffMember = trainer ? config.staff.find((s) => s.id === trainer.staffId) : undefined;
    return staffMember?.name ?? trainerId;
  }

  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createClass({
        name: newName.trim(),
        trainerId: newTrainerId,
        durationMinutes: Number(newDuration),
        capacity: Number(newCapacity),
        category: newCategory.trim() || undefined,
        schedule: newSchedule,
      });
      showToast("Class added.", "success");
      setNewName("");
      setNewDuration("");
      setNewCapacity("");
      setNewCategory("");
      setNewSchedule([emptySlot()]);
      load();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not add the class.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(gymClass: ClassItem) {
    setEditing({
      classId: gymClass.id,
      name: gymClass.name,
      trainerId: gymClass.trainerId,
      durationMinutes: String(gymClass.durationMinutes),
      capacity: String(gymClass.capacity),
      category: gymClass.category ?? "",
      schedule: gymClass.schedule,
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) {
      return;
    }
    setSubmitting(true);
    try {
      await updateClass(editing.classId, {
        name: editing.name.trim(),
        trainerId: editing.trainerId,
        durationMinutes: Number(editing.durationMinutes),
        capacity: Number(editing.capacity),
        category: editing.category.trim() || undefined,
        schedule: editing.schedule,
      });
      showToast("Class updated.", "success");
      setEditing(null);
      load();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not save the change.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(gymClass: ClassItem) {
    if (!confirm(`Delete "${gymClass.name}"? This can't be undone.`)) {
      return;
    }
    try {
      await deleteClass(gymClass.id);
      showToast("Class deleted.", "success");
      load();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not delete the class.", "error");
    }
  }

  if (forbidden) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Classes</h1>
        <p className={`${pageStyles.error} ${pageStyles.section}`}>Only the account owner can manage classes.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Classes</h1>
        <p className={`${pageStyles.error} ${pageStyles.section}`}>{loadError}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Classes</h1>
      </div>
    );
  }

  return (
    <div>
      <h1 className={pageStyles.heading}>Classes</h1>
      <p className={pageStyles.subheading}>{config.classes.length} classes</p>

      <Card className={`${pageStyles.panel} ${pageStyles.section}`}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Trainer</th>
              <th>Duration</th>
              <th>Capacity</th>
              <th>Category</th>
              <th>Schedule</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {config.classes.length === 0 ? (
              <tr>
                <td colSpan={7} className={tableStyles.empty}>
                  No classes yet.
                </td>
              </tr>
            ) : (
              config.classes.map((gymClass) => (
                <tr key={gymClass.id}>
                  <td>{gymClass.name}</td>
                  <td>{trainerLabel(config, gymClass.trainerId)}</td>
                  <td>{gymClass.durationMinutes} min</td>
                  <td>{gymClass.capacity}</td>
                  <td>{gymClass.category ?? "—"}</td>
                  <td>
                    {gymClass.schedule.map((slot) => `${slot.day} ${slot.startTime}`).join(", ")}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button type="button" className={styles.actionLink} onClick={() => startEdit(gymClass)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.deleteLink}
                        onClick={() => handleDelete(gymClass)}
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
          <h2 className={pageStyles.sectionTitle}>Edit {editing.name || "class"}</h2>
          <form className={formStyles.form} onSubmit={handleEditSubmit}>
            <div className={formStyles.field}>
              <label htmlFor="edit-class-name">Name</label>
              <Input
                id="edit-class-name"
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor="edit-class-trainer">Trainer</label>
              <select
                id="edit-class-trainer"
                value={editing.trainerId}
                onChange={(e) => setEditing({ ...editing, trainerId: e.target.value })}
              >
                {config.trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainerLabel(config, trainer.id)}
                  </option>
                ))}
              </select>
            </div>
            <div className={formStyles.field}>
              <label htmlFor="edit-class-duration">Duration (minutes)</label>
              <Input
                id="edit-class-duration"
                type="number"
                min="1"
                required
                value={editing.durationMinutes}
                onChange={(e) => setEditing({ ...editing, durationMinutes: e.target.value })}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor="edit-class-capacity">Capacity</label>
              <Input
                id="edit-class-capacity"
                type="number"
                min="1"
                required
                value={editing.capacity}
                onChange={(e) => setEditing({ ...editing, capacity: e.target.value })}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor="edit-class-category">Category</label>
              <Input
                id="edit-class-category"
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              />
            </div>
            <div className={formStyles.field}>
              <label>Schedule</label>
              <ScheduleEditor
                schedule={editing.schedule}
                onChange={(schedule) => setEditing({ ...editing, schedule })}
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
        <h2 className={pageStyles.sectionTitle}>Add a class</h2>
        <form className={formStyles.form} onSubmit={handleAddClass}>
          <div className={formStyles.field}>
            <label htmlFor="new-class-name">Name</label>
            <Input id="new-class-name" required value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-class-trainer">Trainer</label>
            <select id="new-class-trainer" value={newTrainerId} onChange={(e) => setNewTrainerId(e.target.value)}>
              {config.trainers.length === 0 ? (
                <option value="">No trainers available</option>
              ) : (
                config.trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainerLabel(config, trainer.id)}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-class-duration">Duration (minutes)</label>
            <Input
              id="new-class-duration"
              type="number"
              min="1"
              required
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-class-capacity">Capacity</label>
            <Input
              id="new-class-capacity"
              type="number"
              min="1"
              required
              value={newCapacity}
              onChange={(e) => setNewCapacity(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="new-class-category">Category (optional)</label>
            <Input
              id="new-class-category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label>Schedule</label>
            <ScheduleEditor schedule={newSchedule} onChange={setNewSchedule} />
          </div>
          <Button type="submit" className={formStyles.submit} disabled={submitting || config.trainers.length === 0}>
            {submitting ? "Adding…" : "Add class"}
          </Button>
        </form>
      </div>
    </div>
  );
}
