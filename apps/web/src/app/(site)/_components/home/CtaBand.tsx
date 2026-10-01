import Link from "next/link";
import styles from "./home.module.css";

export function CtaBand() {
  return (
    <section className={styles.section}>
      <div className={`${styles.ph} ${styles.cta}`}>
        <h2 className={styles.ctaH}>Ready to train?</h2>
        <p className={styles.ctaP}>Book a session, meet a coach, and see if it fits.</p>
        <Link href="/book/session" className={`${styles.btn} ${styles.btnAccent}`}>
          Book a session
        </Link>
      </div>
    </section>
  );
}
