import Link from "next/link";
import styles from "./cards.module.css";

type Props = { heading: string; sub: string; buttonLabel: string; href: string };

export function CtaBand({ heading, sub, buttonLabel, href }: Props) {
  return (
    <section className={styles.section}>
      <div className={`${styles.ph} ${styles.cta}`}>
        <h2 className={styles.ctaH}>{heading}</h2>
        <p className={styles.ctaP}>{sub}</p>
        <Link href={href} className={`${styles.btn} ${styles.btnAccent}`}>
          {buttonLabel}
        </Link>
      </div>
    </section>
  );
}
