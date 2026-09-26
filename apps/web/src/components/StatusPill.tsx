import React from "react";
import styles from "./StatusPill.module.css";

export type StatusPillVariant = "success" | "warning" | "danger" | "muted";

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusPillVariant;
  children: React.ReactNode;
}

export function StatusPill({ variant = "muted", className = "", children, ...props }: StatusPillProps) {
  const variantClass = styles[variant] || styles.muted;
  return (
    <span className={`${styles.pill} ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
