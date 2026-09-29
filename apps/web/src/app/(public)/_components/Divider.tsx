import styles from "./Divider.module.css";

export function Divider({ direction = "horizontal", className = "" }: { direction?: "horizontal" | "vertical"; className?: string }) {
  return <div className={`${direction === "vertical" ? styles.vertical : styles.horizontal} ${className}`.trim()} role="separator" aria-orientation={direction} />;
}
