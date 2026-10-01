import Link from "next/link";
import styles from "./PublicButton.module.css";

export type PublicButtonVariant = "primary" | "secondary" | "ghost";

type CommonProps = {
  variant?: PublicButtonVariant;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsLink = CommonProps & { href: string } & Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    "href" | "className"
  >;

type ButtonAsButton = CommonProps & { href?: undefined } & Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "className"
  >;

export type PublicButtonProps = ButtonAsLink | ButtonAsButton;

export function PublicButton({ variant = "primary", className = "", children, ...props }: PublicButtonProps) {
  const variantClass = styles[variant] ?? styles.primary;
  const combined = `${styles.button} ${variantClass} ${className}`.trim();

  if ("href" in props && props.href) {
    const { href, ...anchorProps } = props;
    return (
      <Link href={href} className={combined} {...anchorProps}>
        {children}
      </Link>
    );
  }

  return (
    <button className={combined} {...(props as ButtonAsButton)}>
      {children}
    </button>
  );
}
