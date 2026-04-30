"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Animated count-up. Renders the final value as plain text on the server
 * (so SEO + no-JS users get the right number), then animates from 0 to
 * `to` over `duration` once the component mounts on the client.
 *
 * Uses requestAnimationFrame with an ease-out curve. Triggers once per
 * mount so the user sees it on first page load.
 */
export function CountUp({
  to,
  duration = 1500,
  className,
}: {
  to: number;
  duration?: number;
  className?: string;
}) {
  const [value, setValue] = useState(to);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(to);
      return;
    }

    setValue(0);
    const start = performance.now();
    let rafId: number;

    function step(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // Ease-out cubic.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(to * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      }
    }
    rafId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(rafId);
  }, [to, duration]);

  return <span className={className}>{value.toLocaleString()}</span>;
}
