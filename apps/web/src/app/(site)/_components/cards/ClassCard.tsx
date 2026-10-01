import Link from "next/link";
import type { ClientConfig } from "@localos/config-schema";
import { Arrow } from "../home/Hero";
import { classDays, classImage } from "../home/helpers";

const GRADIENT = "radial-gradient(120% 80% at 70% 10%, #3a3a36 0%, #1a1a18 55%, #0c0c0b 100%)";
import styles from "./cards.module.css";

type Props = { c: ClientConfig["classes"][number]; coach?: string; tz: string };

export function ClassCard({ c, coach, tz }: Props) {
  const img = classImage(c.category);
  return (
    <div className={styles.classCard}>
      <div className={`${styles.ph} ${styles.classPhoto}`} style={{ backgroundImage: `url(${img.src}), ${GRADIENT}`, backgroundPosition: `${img.position}, center` }}>
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
}
