"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { getCatalog } from "@/lib/api";
import { accentTextColor } from "@/lib/color";
import { PublicNav } from "./PublicNav";
import { PublicFooter } from "./PublicFooter";
import "../site.css";
import styles from "./SiteShell.module.css";

const CatalogContext = createContext<ClientConfig | null>(null);

// Catalog fetched once by the shell; null until loaded (or if the fetch fails).
export function useSiteCatalog(): ClientConfig | null {
  return useContext(CatalogContext);
}

const FALLBACK_ACCENT = "#D4F24A";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ClientConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCatalog()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch(() => {
        // Pages handle their own errors; the shell just stays generic.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accent = config?.business.primaryColor ?? FALLBACK_ACCENT;
  const vars = { "--site-accent": accent, "--site-accent-ink": accentTextColor(accent) } as React.CSSProperties;

  return (
    <CatalogContext.Provider value={config}>
      <div className={styles.wrap} style={vars}>
        <PublicNav />
        <main className={styles.main}>{children}</main>
        <PublicFooter />
      </div>
    </CatalogContext.Provider>
  );
}
