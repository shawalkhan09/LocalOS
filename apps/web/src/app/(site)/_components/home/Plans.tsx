import type { ClientConfig } from "@localos/config-schema";
import { PlanCard } from "../cards/PlanCard";
import styles from "./home.module.css";

const SUFFIX = { monthly: "/ month", annual: "/ year", week: "/ week", day: "/ day" } as const;

export function Plans({ cfg }: { cfg: ClientConfig }) {
  const plans = cfg.membershipPlans;
  if (!plans.length) return null;
  const popular = plans.length >= 3 && plans.length % 2 === 1 ? (plans.length - 1) / 2 : -1;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cfg.business.currency,
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  return (
    <section id="membership" className={styles.section}>
      <div className={`${styles.headCol} ${styles.center}`}>
        <span className={styles.eyebrow}>Membership</span>
        <h2 className={styles.h2}>Plans that fit how you train.</h2>
      </div>
      <div className={styles.grid3}>
        {plans.map((p, i) => (
          <PlanCard key={p.id} name={p.name} price={fmt(Number(p.price))} suffix={SUFFIX[p.billingInterval]} perks={p.perks} popular={i === popular} />
        ))}
      </div>
    </section>
  );
}
