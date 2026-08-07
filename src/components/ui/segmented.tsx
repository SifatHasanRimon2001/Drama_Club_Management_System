"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
  scrollable = false,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
  /** Allow the control to scroll horizontally on narrow viewports instead of overflowing. */
  scrollable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
    if (el && ref.current?.contains(document.activeElement)) el.focus();
  }, [value]);

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label="Filter"
      className={cn(
        "inline-flex items-center rounded-full bg-black/[0.06] p-1 dark:bg-white/10",
        scrollable && "no-scrollbar max-w-full overflow-x-auto",
        className
      )}
    >
      {options.map((opt, index) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              const dir = e.key === "ArrowRight" ? 1 : -1;
              const next = options[(index + dir + options.length) % options.length];
              if (next) onChange(next.value);
            }}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-all duration-200",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              size === "sm" ? "px-3 py-1 text-[13px]" : "px-4 py-1.5 text-sm",
              active
                ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#3a3a3c] dark:text-white"
                : "text-sub hover:text-ink dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
