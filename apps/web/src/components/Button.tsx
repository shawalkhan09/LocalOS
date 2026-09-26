import React from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "destructive";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const variantClass = styles[variant] || styles.primary;
  return (
    <button className={`${styles.button} ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
