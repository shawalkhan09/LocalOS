import Link from "next/link";
import type { ClientConfig } from "@localos/config-schema";
import { Arrow } from "./Hero";
import { classDays } from "./helpers";
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
          return (
            <div key={c.id} className={styles.classCard}>
              <div className={`${styles.ph} ${styles.classPhoto}`}>
                {c.category && <span className={styles.chip}>{c.category}</span>}
              </div>
              <div className={styles.classBody}>
                <h3 className={styles.h3}>{c.name}</h3>
                <p className={styles.classP}>
                  {c.durationMinutes} min · up to {c.capacity}
                  {coach ? ` · with ${coach}` : ""}
                </p>
                <div className={styles.classFoot}>
                  <span>{classDays(c.schedule, tz)}</span>
                  <Link href="/book/class" className={styles.bookLink}>
                    Book <Arrow size={14} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
