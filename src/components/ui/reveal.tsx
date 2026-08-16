"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Reveals its children as they scroll into view.
 *
 * Content must never be gated behind an animation that might not run, so this
 * reveals on whichever of three signals arrives first:
 *
 *  1. The element is already within (or near) the viewport at mount — the
 *     above-the-fold case, handled synchronously without waiting on a callback.
 *  2. An IntersectionObserver reports it scrolling into view.
 *  3. A failsafe timer, in case the observer never fires at all.
 *
 * (3) is not paranoia: IntersectionObserver callbacks depend on the browser's
 * rendering pipeline and do not fire in a tab that is never composited —
 * background tabs, some embedded webviews, headless captures. Without the
 * timer those environments would render a permanently blank page.
 *
 * Reduced-motion and no-JS are handled in globals.css.
 */

/** Reveal anything within this many px of the viewport at mount. */
const NEAR_VIEWPORT_PX = 120;
/** Upper bound on how long content may stay hidden waiting for the observer. */
const FAILSAFE_MS = 1200;

export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className,
}: {
  children: ReactNode;
  /** Stagger in ms. Keep under ~240ms — longer reads as lag, not choreography. */
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Idempotent — safe to call from whichever signal arrives first.
    const show = () => el.setAttribute("data-visible", "true");

    // (1) Reduced motion, or already on screen: reveal synchronously. Waiting
    // on a callback here would flash an empty hero on first paint.
    const rect = el.getBoundingClientRect();
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      rect.top < window.innerHeight + NEAR_VIEWPORT_PX
    ) {
      show();
      return;
    }

    // (2) Below the fold: animate in on scroll.
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((e) => e.isIntersecting)) show();
            },
            { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
          )
        : undefined;
    observer?.observe(el);

    // (3) Guarantee visibility even if (2) never reports anything. Firing after
    // the observer already revealed the element is a harmless no-op.
    const failsafe = setTimeout(show, FAILSAFE_MS);

    return () => {
      observer?.disconnect();
      clearTimeout(failsafe);
    };
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn("reveal", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
