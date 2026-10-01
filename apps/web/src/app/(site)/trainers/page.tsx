"use client";

import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { ApiRequestError, getCatalog } from "@/lib/api";
import { PageHeader } from "../_components/PageHeader";
import { TrainerCard } from "../_components/cards/TrainerCard";
import styles from "./page.module.css";

export default function TrainersPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCatalog()
      .then(setConfig)
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : "Could not load trainers.");
      });
  }, []);

  const header = <PageHeader eyebrow="The coaches" title="Meet the coaches" subtitle="Every session is run by a coach on this roster." />;

  if (!config && !error) return <div className={styles.page} style={{ minHeight: "60vh" }} />;

  return (
    <div className={styles.page}>
      {header}
      <div className={styles.body}>
        {error ? (
          <p className={styles.note}>{error}</p>
        ) : config!.trainers.length === 0 ? (
          <p className={styles.note}>No trainers are listed right now.</p>
        ) : (
          <div className={styles.grid}>
            {config!.trainers.map((trainer) => {
              const staff = config!.staff.find((s) => s.id === trainer.staffId);
              return (
                <TrainerCard
                  key={trainer.id}
                  name={staff?.name ?? "Unnamed coach"}
                  role={staff?.role}
                  photoUrl={trainer.photoUrl}
                  bio={trainer.bio ?? staff?.bio}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
