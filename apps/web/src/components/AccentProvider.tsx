"use client";

import { useEffect } from "react";
import { getCatalog } from "@/lib/api";

export function AccentProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    getCatalog()
      .then((config) => {
        if (!cancelled && config?.business?.primaryColor) {
          document.documentElement.style.setProperty("--color-accent", config.business.primaryColor);
        }
      })
      .catch(() => {
        // Fallback default CSS token --color-accent is preserved if fetch fails
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
