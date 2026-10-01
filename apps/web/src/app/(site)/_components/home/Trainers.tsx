import type { ClientConfig } from "@localos/config-schema";
import { TrainerCard } from "../cards/TrainerCard";
import styles from "./home.module.css";

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
          <TrainerCard key={t.id} name={s!.name} role={s!.role} photoUrl={t.photoUrl} />
        ))}
      </div>
    </section>
  );
}
