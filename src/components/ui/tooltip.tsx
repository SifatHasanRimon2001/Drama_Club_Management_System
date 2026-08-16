"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Side = "top" | "bottom" | "left" | "right";

const sideClasses: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

/**
 * Tooltip on a wrapped trigger.
 *
 * Opens on hover *and* on keyboard focus, and closes on Escape, so the content
 * is reachable without a pointer. The bubble is `role="tooltip"` and linked via
 * aria-describedby rather than replacing the trigger's own accessible name.
 *
 * Touch devices get no tooltip at all — there is no hover, and a tap-to-reveal
 * bubble competes with the trigger's real action. Anything essential belongs in
 * visible copy, never only in here.
 */
export function Tooltip({
  content,
  side = "top",
  children,
  className,
}: {
  content: ReactNode;
  side?: Side;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            "animate-fade pointer-events-none absolute z-[80] w-max max-w-[min(16rem,calc(100vw-2rem))]",
            "rounded-lg border border-line-strong bg-elevated px-2.5 py-1.5",
            "text-[12.5px] font-medium leading-snug text-ink shadow-pop",
            sideClasses[side]
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
