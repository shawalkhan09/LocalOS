import Link from "next/link";
import styles from "./cards.module.css";

type Props = { name: string; price: string; suffix: string; perks?: string[]; popular?: boolean };

export function PlanCard({ name, price, suffix, perks, popular }: Props) {
  return (
    <div className={`${styles.plan} ${popular ? styles.planDark : styles.planLight}`}>
      <div className={styles.planHead}>
        <span className={styles.planName}>{name}</span>
        {popular && <span className={styles.chip}>Most popular</span>}
      </div>
      <div className={styles.price}>
        <span className={styles.priceV}>{price}</span>
        <span className={styles.priceS}>{suffix}</span>
      </div>
      <div className={styles.perks}>
        {perks?.map((perk) => (
          <div key={perk} className={styles.perk}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className={styles.tick} aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            {perk}
          </div>
        ))}
      </div>
      <Link href="/membership" className={styles.planBtn}>
        Choose {name}
      </Link>
    </div>
  );
}
