import type { ClientConfig } from "@localos/config-schema";
import { PlanCard } from "../cards/PlanCard";
import { PLAN_SUFFIX, planPriceFormatter, popularPlanIndex } from "./helpers";
import styles from "./home.module.css";

export function Plans({ cfg }: { cfg: ClientConfig }) {
  const plans = cfg.membershipPlans;
  if (!plans.length) return null;
  const popular = popularPlanIndex(plans.length);
  const fmt = planPriceFormatter(cfg.business.currency);
  return (
    <section id="membership" className={styles.section}>
      <div className={`${styles.headCol} ${styles.center}`}>
        <span className={styles.eyebrow}>Membership</span>
        <h2 className={styles.h2}>Plans that fit how you train.</h2>
      </div>
      <div className={styles.grid3} style={{ "--n": Math.min(plans.length, 3) } as React.CSSProperties}>
        {plans.map((p, i) => (
          <PlanCard key={p.id} name={p.name} price={fmt(Number(p.price))} suffix={PLAN_SUFFIX[p.billingInterval]} perks={p.perks} popular={i === popular} />
        ))}
      </div>
    </section>
  );
}
