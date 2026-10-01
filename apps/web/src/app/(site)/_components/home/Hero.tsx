import Link from "next/link";
import type { ClientConfig } from "@localos/config-schema";
import { isOpenNow, nextClass } from "./helpers";
import styles from "./home.module.css";

const FALLBACK_COPY =
  "Coached strength, conditioning and recovery under one roof. Pick a plan, book your first session, and train with people who push you.";

export function Hero({ cfg, hasHero }: { cfg: ClientConfig; hasHero: boolean }) {
  const slots = cfg.classes.reduce((n, c) => n + c.schedule.length, 0);
  const stats = [
    { v: slots, l: "Weekly classes" },
    { v: cfg.trainers.length, l: "Coaches" },
    { v: new Set(cfg.classes.map((c) => c.category).filter(Boolean)).size, l: "Disciplines" },
  ].filter((s) => s.v > 0);
  const next = nextClass(cfg);
  const open = isOpenNow(cfg);

  return (
    <section className={styles.hero}>
      <div className={styles.heroText}>
        <h1 className={styles.heroH}>
          Built to be <span className={styles.hl}>unbreakable.</span>
        </h1>
        <p className={styles.heroP}>{cfg.business.description || FALLBACK_COPY}</p>
        <div className={styles.btnRow}>
          <Link href="/book/session" className={`${styles.btn} ${styles.btnDark}`}>
            Book a session <Arrow />
          </Link>
          <a href="#classes" className={`${styles.btn} ${styles.btnOutline}`}>
            View timetable
          </a>
        </div>
        {stats.length > 0 && (
          <div className={styles.stats}>
            {stats.map((s) => (
              <div key={s.l} className={styles.stat}>
                <span className={styles.statV}>{s.v}</span>
                <span className={styles.statL}>{s.l}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={styles.heroMedia}>
        <div
          className={`${styles.heroPhoto} ${hasHero ? "" : styles.ph}`}
          style={hasHero ? { backgroundImage: "url(/images/hero.jpg)" } : undefined}
        />
        {next && (
          <div className={styles.nextCard}>
            <span className={styles.nextIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <div className={styles.nextText}>
              <span className={styles.nextL}>Next class</span>
              <span className={styles.nextV}>
                {next.name}, {next.when}
              </span>
            </div>
          </div>
        )}
        <div className={styles.openChip}>
          <span className={styles.dot} style={{ background: open ? "#16a34a" : "#9a9a92" }} />
          {open ? "Open now" : "Closed"}
        </div>
      </div>
    </section>
  );
}

export function Arrow({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
