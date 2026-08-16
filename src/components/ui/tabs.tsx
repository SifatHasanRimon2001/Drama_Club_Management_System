"use client";

import { useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  /** Optional trailing count, e.g. "Members 12". */
  count?: number;
}

/**
 * Underlined tab bar with a sliding violet indicator.
 *
 * Implements the WAI-ARIA tabs pattern: roving tabindex, arrow-key navigation,
 * Home/End jumps, and `aria-controls` wiring to the matching TabPanel. Only the
 * active tab is in the tab order, so keyboard users step past the whole bar in
 * one press rather than tabbing through every option.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  idBase,
  className,
  size = "md",
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Shared id prefix linking each tab to its panel. Generated when omitted. */
  idBase?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const autoId = useId();
  const base = idBase ?? autoId;
  const listRef = useRef<HTMLDivElement>(null);

  const focusTab = (next: T) => {
    onChange(next);
    // Move focus with the selection so the pattern stays keyboard-coherent.
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLButtonElement>(`[data-tab="${CSS.escape(next)}"]`)
        ?.focus();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = items.length - 1;
    let nextIndex: number | null = null;

    if (e.key === "ArrowRight") nextIndex = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") nextIndex = index === 0 ? last : index - 1;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = last;

    if (nextIndex === null) return;
    e.preventDefault();
    const next = items[nextIndex];
    if (next) focusTab(next.value);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn(
        "no-scrollbar relative flex items-center gap-1 overflow-x-auto border-b border-line",
        className
      )}
    >
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            data-tab={item.value}
            id={`${base}-tab-${item.value}`}
            aria-selected={active}
            aria-controls={`${base}-panel-${item.value}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-medium",
              "transition-colors duration-200",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              size === "sm" ? "px-3 py-2.5 text-[13px]" : "px-4 py-3 text-[13.5px]",
              active ? "text-ink" : "text-faint hover:text-sub"
            )}
          >
            {item.icon && <Icon name={item.icon} size={15} />}
            {item.label}
            {typeof item.count === "number" && (
              <span
                className={cn(
                  "tabular rounded-full px-1.5 py-0.5 text-[11px] font-semibold transition-colors",
                  active ? "bg-accent-soft-strong text-accent-ink" : "bg-elevated text-faint"
                )}
              >
                {item.count}
              </span>
            )}
            {/* Indicator sits on the shared bottom border. */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-all duration-300",
                active
                  ? "bg-gradient-to-r from-[var(--grad-1)] to-[var(--grad-2)] opacity-100"
                  : "opacity-0"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Panel paired with a Tabs item. Render one per tab; only the active shows. */
export function TabPanel({
  active,
  value,
  idBase,
  children,
  className,
}: {
  active: boolean;
  value: string;
  idBase: string;
  children: ReactNode;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      tabIndex={0}
      className={cn("animate-fade focus-visible:outline-none", className)}
    >
      {children}
    </div>
  );
}
