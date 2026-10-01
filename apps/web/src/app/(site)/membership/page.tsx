"use client";

import { useEffect, useState } from "react";
import type { ClientConfig, MembershipPlan } from "@localos/config-schema";
import { ApiRequestError, getCatalog } from "@/lib/api";
import { PublicButton } from "../_components/PublicButton";
import { PublicPanel } from "../_components/PublicPanel";
import { Divider } from "../_components/Divider";
import styles from "./page.module.css";

const INTERVAL_LABEL: Record<MembershipPlan["billingInterval"], string> = {
  monthly: "/month",
  annual: "/year",
  week: "/week",
  day: "/day",
};

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="var(--pub-accent-gold)" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

function PlanBody({ plan, savings }: { plan: MembershipPlan; savings?: number }) {
  return (
    <>
      <div className={styles.planHeader}>
        <h2 className={styles.planName}>{plan.name}</h2>
        {savings !== undefined && savings > 0 && (
          <span className={styles.savingsBadge}>Save ${savings.toLocaleString()}/year</span>
        )}
      </div>
      <p className={styles.planPrice}>
        <span className={styles.priceAmount}>${plan.price.toLocaleString()}</span>
        <span className={styles.priceInterval}>{INTERVAL_LABEL[plan.billingInterval]}</span>
      </p>
      {plan.description && <p className={styles.planDescription}>{plan.description}</p>}
      {plan.perks && plan.perks.length > 0 && (
        <ul className={styles.perkList}>
          {plan.perks.map((perk) => (
            <li key={perk} className={styles.perkItem}>
              <CheckIcon />
              <span>{perk}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function MembershipPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCatalog()
      .then(setConfig)
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : "Could not load membership plans.");
      });
  }, []);

  if (error) {
    return (
      <div className={styles.wrap}>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (!config) {
    return <div className={styles.wrap} />;
  }

  const plans = config.membershipPlans;
  const monthly = plans.find((p) => p.billingInterval === "monthly");
  const annual = plans.find((p) => p.billingInterval === "annual");
  const annualSavings = monthly && annual ? Math.max(0, monthly.price * 12 - annual.price) : undefined;

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <p className="pubIndexLabel">03 / MEMBERSHIP</p>
        <h1 className={styles.title}>Membership plans</h1>
        <p className={styles.subtitle}>No hidden fees. Cancel according to your plan&apos;s own terms.</p>
      </header>

      {plans.length === 0 ? (
        <p className={styles.empty}>No membership plans are published yet.</p>
      ) : plans.length === 2 ? (
        <div className={styles.twoColumn}>
          <PublicPanel className={styles.planPanel}>
            <PlanBody plan={plans[0]} savings={plans[0].billingInterval === "annual" ? annualSavings : undefined} />
            <PublicButton href="/book/session" variant="ghost" className={styles.planCta}>
              Choose {plans[0].name}
            </PublicButton>
          </PublicPanel>
          <Divider direction="vertical" className={styles.columnDivider} />
          <PublicPanel goldAccent className={styles.planPanel}>
            <PlanBody plan={plans[1]} savings={plans[1].billingInterval === "annual" ? annualSavings : undefined} />
            <PublicButton href="/book/session" variant="primary" className={styles.planCta}>
              Choose {plans[1].name}
            </PublicButton>
          </PublicPanel>
        </div>
      ) : (
        <div className={styles.stack}>
          {plans.map((plan) => (
            <PublicPanel key={plan.id} className={styles.planPanel}>
              <PlanBody plan={plan} savings={plan.billingInterval === "annual" ? annualSavings : undefined} />
              <PublicButton href="/book/session" variant="ghost" className={styles.planCta}>
                Choose {plan.name}
              </PublicButton>
            </PublicPanel>
          ))}
        </div>
      )}
    </div>
  );
}
