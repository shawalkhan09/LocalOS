"use client";

import { useState } from "react";
import styles from "./cards.module.css";

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

type Props = { name: string; role?: string; photoUrl?: string; bio?: string };

export function TrainerCard({ name, role, photoUrl, bio }: Props) {
  return (
    <div className={styles.trainer}>
      <div className={styles.trainerPhoto}>
        <Photo url={photoUrl} name={name} />
      </div>
      <div className={styles.trainerInfo}>
        <span className={styles.trainerName}>{name}</span>
        {role && <span className={styles.trainerRole}>{role}</span>}
        {bio && <p className={styles.trainerBio}>{bio}</p>}
      </div>
    </div>
  );
}
