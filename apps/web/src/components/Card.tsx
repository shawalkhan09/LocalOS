import React from "react";
import styles from "./Card.module.css";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
  children: React.ReactNode;
}

export function Card({ raised = false, className = "", children, ...props }: CardProps) {
  const classes = `${styles.card} ${raised ? styles.raised : ""} ${className}`.trim();
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
