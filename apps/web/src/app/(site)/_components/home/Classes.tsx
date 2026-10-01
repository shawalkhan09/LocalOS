import Link from "next/link";
import type { ClientConfig } from "@localos/config-schema";
import { ClassCard } from "../cards/ClassCard";
import styles from "./home.module.css";

export function Classes({ cfg }: { cfg: ClientConfig }) {
  if (!cfg.classes.length) return null;
  const tz = cfg.business.timezone;
  const nameOf = (trainerId: string) => {
    const t = cfg.trainers.find((x) => x.id === trainerId);
    return cfg.staff.find((s) => s.id === t?.staffId)?.name;
  };
  return (
    <section id="classes" className={styles.section}>
      <div className={styles.headRow}>
        <h2 className={styles.h2}>Classes for every level.</h2>
        <Link href="/classes" className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}>
          Full timetable
        </Link>
      </div>
      <div className={styles.grid4}>
        {cfg.classes.slice(0, 4).map((c) => {
          const coach = nameOf(c.trainerId);
          return <ClassCard key={c.id} c={c} coach={coach} tz={tz} />;
        })}
      </div>
    </section>
  );
}
