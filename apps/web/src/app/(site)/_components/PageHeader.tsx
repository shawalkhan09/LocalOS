import styles from "./PageHeader.module.css";

type Props = { eyebrow: string; title: string; subtitle?: string };

export function PageHeader({ eyebrow, title, subtitle }: Props) {
  return (
    <header className={styles.head}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.sub}>{subtitle}</p>}
    </header>
  );
}
