import Link from "next/link";
import type { ClientConfig } from "@localos/config-schema";
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
          <div key={p.id} className={`${styles.plan} ${i === popular ? styles.planDark : styles.planLight}`}>
            <div className={styles.planHead}>
              <span className={styles.planName}>{p.name}</span>
              {i === popular && <span className={styles.chip}>Most popular</span>}
            </div>
            <div className={styles.price}>
              <span className={styles.priceV}>{fmt(Number(p.price))}</span>
              <span className={styles.priceS}>{SUFFIX[p.billingInterval]}</span>
            </div>
            <div className={styles.perks}>
              {p.perks?.map((perk) => (
                <div key={perk} className={styles.perk}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className={styles.tick} aria-hidden>
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  {perk}
                </div>
              ))}
            </div>
            <Link href="/membership" className={styles.planBtn}>
              Choose {p.name}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
