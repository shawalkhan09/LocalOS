"use client";

import { useEffect, useRef, useState } from "react";

// Fires once, on first scroll-into-view — same IntersectionObserver
// pattern as CountUpStat.tsx. Respects prefers-reduced-motion by skipping
// straight to the visible end state instead of animating into it.
export function FadeUpOnScroll({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const shown = visible || reduceMotion;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(16px)",
        transition: reduceMotion ? "none" : "opacity 500ms ease-out, transform 500ms ease-out",
      }}
    >
      {children}
    </div>
  );
}
