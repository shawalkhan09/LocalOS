"use client";

import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { ApiRequestError, getCatalog } from "@/lib/api";
import { PageHeader } from "../_components/PageHeader";
import { PlanCard } from "../_components/cards/PlanCard";
import { CtaBand } from "../_components/cards/CtaBand";
import { PLAN_SUFFIX, planPriceFormatter, popularPlanIndex } from "../_components/home/helpers";
import styles from "./page.module.css";

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

  if (!config && !error) return <div className={styles.page} style={{ minHeight: "60vh" }} />;

  const plans = config?.membershipPlans ?? [];
  const fmt = planPriceFormatter(config?.business.currency ?? "USD");
  const popular = popularPlanIndex(plans.length);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Membership"
        title="Membership plans"
        subtitle={config ? `Choose a plan at ${config.business.name}.` : undefined}
      />
      <div className={styles.body}>
        {error ? (
          <p className={styles.note}>{error}</p>
        ) : plans.length === 0 ? (
          <p className={styles.note}>No membership plans are published yet.</p>
        ) : (
          <div className={styles.grid}>
            {plans.map((p, i) => (
              <PlanCard key={p.id} name={p.name} price={fmt(Number(p.price))} suffix={PLAN_SUFFIX[p.billingInterval]} perks={p.perks} popular={i === popular} />
            ))}
          </div>
        )}
      </div>
      {config && (
        <CtaBand heading="Ready to train?" sub="Book a session, meet a coach, and see if it fits." buttonLabel="Book a session" href="/book/session" />
      )}
    </div>
  );
}
