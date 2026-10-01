"use client";

import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { ApiRequestError, getCatalog } from "@/lib/api";
import { PageHeader } from "../_components/PageHeader";
import { ClassCard } from "../_components/cards/ClassCard";
import styles from "./page.module.css";

export default function ClassesPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    getCatalog()
      .then(setConfig)
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : "Could not load classes.");
      });
  }, []);

  const header = <PageHeader eyebrow="Timetable" title="Classes" subtitle="Programmed strength and conditioning sessions, run every week." />;

  if (error) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.body}>
          <p className={styles.note}>{error}</p>
        </div>
      </div>
    );
  }

  if (!config) return <div className={styles.page} style={{ minHeight: "60vh" }} />;

  const categories = [...new Set(config.classes.map((c) => c.category).filter((c): c is string => !!c))];
  const shown = config.classes.filter((c) => !category || c.category === category);
  const coachOf = (trainerId: string) => {
    const t = config.trainers.find((x) => x.id === trainerId);
    return config.staff.find((x) => x.id === t?.staffId)?.name;
  };

  return (
    <div className={styles.page}>
      {header}
      <div className={styles.body}>
        {categories.length >= 2 && (
          <div className={styles.chips}>
            {[null, ...categories].map((c) => (
              <button key={c ?? "all"} type="button" className={styles.chip} aria-pressed={category === c} onClick={() => setCategory(c)}>
                {c ?? "All"}
              </button>
            ))}
          </div>
        )}
        {config.classes.length === 0 ? (
          <p className={styles.note}>No classes are scheduled right now.</p>
        ) : (
          <div className={styles.grid}>
            {shown.map((c) => (
              <ClassCard key={c.id} c={c} coach={coachOf(c.trainerId)} tz={config.business.timezone} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
