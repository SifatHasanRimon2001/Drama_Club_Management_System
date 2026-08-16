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
      onClick={(e) => {
        // Allow rows that wrap this toggle to also handle clicks without
        // double-toggling (nested interactive elements are invalid).
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "flex items-center gap-3 text-left",
        disabled && "opacity-50"
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200",
          checked
            ? "bg-accent shadow-[0_0_14px_var(--color-accent-soft-strong)]"
            : "bg-line-strong"
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
            <span className="block text-[14.5px] font-medium text-ink">
              {label}
            </span>
          )}
          {description && (
            <span className="block text-[13px] text-sub">
              {description}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
