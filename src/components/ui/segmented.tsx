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
        "inline-flex items-center rounded-xl border border-line bg-elevated p-1",
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
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-all duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-4 py-2 text-[13.5px]",
              active
                ? "bg-accent font-semibold text-on-accent shadow-[0_2px_10px_var(--color-accent-soft-strong)]"
                : "text-faint hover:text-ink"
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
