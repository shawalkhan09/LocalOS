"use client";

import { useSiteCatalog } from "../SiteShell";
import { Hero } from "./Hero";
import { Marquee } from "./Marquee";
import { Classes } from "./Classes";
import { Trainers } from "./Trainers";
import { Plans } from "./Plans";
import { CtaBand } from "../cards/CtaBand";
import styles from "./home.module.css";

export function HomeSections() {
  const cfg = useSiteCatalog();
  // Catalog failure leaves this null too; the page stays blank rather than broken.
  if (!cfg) return <div className={styles.page} style={{ minHeight: "60vh" }} />;
  return (
    <div className={styles.page}>
      <Hero cfg={cfg} />
      <Marquee cfg={cfg} />
      <Classes cfg={cfg} />
      <Trainers cfg={cfg} />
      <Plans cfg={cfg} />
      <CtaBand heading="Ready to train?" sub="Book a session, meet a coach, and see if it fits." buttonLabel="Book a session" href="/book/session" />
    </div>
  );
}
