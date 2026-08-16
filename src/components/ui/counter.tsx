"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Counts up to `value` the first time the element scrolls into view.
 *
 * Deliberately conservative:
 *  - Respects prefers-reduced-motion by rendering the final value immediately.
 *  - Renders the final value on the server and before the observer fires, so
 *    the real number is present for crawlers, screen readers and no-JS users
 *    rather than a placeholder zero.
 *  - Uses tabular figures so the digits do not reflow while animating.
 */
export function AnimatedCounter({
  value,
  duration = 1400,
  suffix = "",
  prefix = "",
  className,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const hasRun = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // `display` already holds the final value, so honouring reduced motion is
    // simply a matter of never starting the animation.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || hasRun.current) return;
        hasRun.current = true;
        observer.disconnect();

        const start = performance.now();
        let frame = 0;

        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutExpo — fast start, long settle. Reads as "counting up".
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          setDisplay(Math.round(value * eased));
          if (t < 1) frame = requestAnimationFrame(tick);
        };

        // Start from zero only once we know the animation will actually run.
        setDisplay(0);
        frame = requestAnimationFrame(tick);

        cleanupFrame = () => cancelAnimationFrame(frame);
      },
      { threshold: 0.4 }
    );

    let cleanupFrame: (() => void) | undefined;
    observer.observe(el);

    return () => {
      observer.disconnect();
      cleanupFrame?.();
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
