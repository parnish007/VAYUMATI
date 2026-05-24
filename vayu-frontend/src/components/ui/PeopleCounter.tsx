"use client";

import { useEffect, useRef, useState } from "react";

interface PeopleCounterProps { count: number; }

export function PeopleCounter({ count }: PeopleCounterProps) {
  const [displayed, setDisplayed] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const start = displayed;
    const duration = 1200;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + (count - start) * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4"
      style={{ background: "#112217", border: "1px solid rgba(61,139,94,0.12)" }}
    >
      <p
        className="font-display font-black leading-none flex-shrink-0 tabular-nums"
        style={{ fontSize: 32, color: "#e05a38" }}
      >
        {displayed.toLocaleString()}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: "#8aad96" }}>
        <strong className="text-parchment block">people</strong>
        in monitored wards breathing above WHO 24h limit right now
      </p>
    </div>
  );
}
