import styles from "./PublicPanel.module.css";

export function PublicPanel({
  goldAccent = false,
  className = "",
  children,
}: {
  goldAccent?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`${styles.panel} ${goldAccent ? styles.goldAccent : ""} ${className}`.trim()}>{children}</div>;
}
