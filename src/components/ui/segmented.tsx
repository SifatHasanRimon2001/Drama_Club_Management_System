"use client";

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
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full bg-black/[0.06] p-1 dark:bg-white/10",
        className
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-all duration-200",
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
