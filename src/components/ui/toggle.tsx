"use client";

import { cn } from "@/lib/cn";

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-3 text-left",
        disabled && "opacity-50"
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "bg-green" : "bg-black/20 dark:bg-white/25"
        )}
      >
        <span
          className={cn(
            "absolute size-[27px] rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.3)] transition-all duration-200",
            checked ? "left-[22px]" : "left-[2px]"
          )}
        />
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && (
            <span className="block text-[15px] font-medium text-ink dark:text-gray-100">
              {label}
            </span>
          )}
          {description && (
            <span className="block text-[13px] text-sub dark:text-gray-400">
              {description}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
