import Link from "next/link";
import styles from "./BookingConfirmation.module.css";

export function BookingConfirmation({
  title,
  lines,
}: {
  title: string;
  lines: string[];
}) {
  return (
    <div className={styles.card}>
      <div className={styles.check} aria-hidden="true">
        ✓
      </div>
      <h1 className={styles.title}>{title}</h1>
      {lines.map((line) => (
        <p key={line} className={styles.detail}>
          {line}
        </p>
      ))}
      <Link href="/" className={styles.backLink}>
        Back to home
      </Link>
    </div>
  );
}
