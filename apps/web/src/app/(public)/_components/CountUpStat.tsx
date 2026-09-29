"use client";

import { useEffect, useRef, useState } from "react";

const COUNT_UP_MS = 900;

// Fires once, on first scroll-into-view — never re-triggers if the stat
// scrolls out and back in.
export function CountUpStat({ value, label }: { value: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        const start = performance.now();
        function tick(now: number) {
          const progress = Math.min((now - start) / COUNT_UP_MS, 1);
          setDisplay(Math.round(value * progress));
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref}>
      <div style={{ fontFamily: "var(--pub-font-mono)", fontWeight: 800, fontSize: "clamp(32px, 5vw, 48px)", letterSpacing: "-0.02em" }}>
        {display}
      </div>
      <div style={{ color: "var(--pub-text-muted)", fontSize: 14, marginTop: 4 }}>{label}</div>
    </div>
  );
}
