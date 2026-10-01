"use client";

import { useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import styles from "./home.module.css";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function Photo({ url, name }: { url?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={styles.trainerImg} onError={() => setFailed(true)} />;
  }
  return <div className={`${styles.ph} ${styles.trainerPh}`}>{initials(name)}</div>;
}

export function Trainers({ cfg }: { cfg: ClientConfig }) {
  const list = cfg.trainers
    .map((t) => ({ t, s: cfg.staff.find((x) => x.id === t.staffId) }))
    .filter((x) => x.s)
    .slice(0, 4);
  if (!list.length) return null;
  return (
    <section id="trainers" className={styles.section}>
      <div className={styles.headCol}>
        <span className={styles.eyebrow}>The coaches</span>
        <h2 className={styles.h2}>Real coaches. Real results.</h2>
      </div>
      <div className={styles.grid4}>
        {list.map(({ t, s }) => (
          <div key={t.id} className={styles.trainer}>
            <div className={styles.trainerPhoto}>
              <Photo url={t.photoUrl} name={s!.name} />
            </div>
            <div className={styles.trainerInfo}>
              <span className={styles.trainerName}>{s!.name}</span>
              <span className={styles.trainerRole}>{s!.role}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
