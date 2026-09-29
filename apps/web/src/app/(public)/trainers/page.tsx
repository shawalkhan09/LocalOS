"use client";

import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { ApiRequestError, getCatalog } from "@/lib/api";
import { PublicPanel } from "../_components/PublicPanel";
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

  if (error) {
    return (
      <div className={styles.wrap}>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (!config) {
    return <div className={styles.wrap} />;
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <p className="pubIndexLabel">02 / COACHING</p>
        <h1 className={styles.title}>The coaching staff</h1>
        <p className={styles.subtitle}>Every session is run by a coach on this roster.</p>
      </header>

      {config.trainers.length === 0 ? (
        <p className={styles.empty}>No trainers are listed right now.</p>
      ) : (
        <div className={styles.grid}>
          {config.trainers.map((trainer) => {
            const staff = config.staff.find((s) => s.id === trainer.staffId);
            const bio = trainer.bio ?? staff?.bio;
            const classesTaught = config.classes.filter((c) => c.trainerId === trainer.id);

            return (
              <PublicPanel key={trainer.id} className={styles.card}>
                {trainer.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={trainer.photoUrl} alt="" className={styles.photo} />
                ) : (
                  <div className={styles.photoPlaceholder} aria-hidden="true" />
                )}
                <h2 className={styles.name}>{staff?.name ?? "Unnamed coach"}</h2>
                {staff?.role && <p className={styles.role}>{staff.role}</p>}
                {bio && <p className={styles.bio}>{bio}</p>}

                {trainer.specialties && trainer.specialties.length > 0 && (
                  <div className={styles.tagRow}>
                    {trainer.specialties.map((s) => (
                      <span key={s} className={styles.tag}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {trainer.certifications && trainer.certifications.length > 0 && (
                  <div className={styles.tagRow}>
                    {trainer.certifications.map((c) => (
                      <span key={c} className={styles.tagGold}>
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {classesTaught.length > 0 && (
                  <p className={styles.classesTaught}>Teaches: {classesTaught.map((c) => c.name).join(", ")}</p>
                )}
              </PublicPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
