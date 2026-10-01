import type { ClientConfig } from "@localos/config-schema";
import styles from "./home.module.css";

export function Marquee({ cfg }: { cfg: ClientConfig }) {
  const items = [...new Set([...cfg.classes.map((c) => c.name), ...cfg.services.map((s) => s.name)])];
  if (!items.length) return null;
  const run = (hidden: boolean) => (
    <div className={styles.marqueeRun} aria-hidden={hidden || undefined} data-dup={hidden || undefined}>
      {items.map((m) => (
        <span key={m} className={styles.marqueeItem}>
          {m} <span className={styles.marqueeDot}>●</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className={styles.marquee}>
      <div className={styles.marqueeTrack}>
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}
