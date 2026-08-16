import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";

type StatTone = "blue" | "green" | "orange" | "purple" | "red" | "teal" | "gray";

/**
 * Icon chips use the same translucent-tint recipe as Badge so a stat row and a
 * status row never disagree about what "green" looks like.
 */
const iconTones: Record<StatTone, string> = {
  blue: "bg-accent-soft-strong text-accent-ink",
  green: "bg-green/12 text-green",
  orange: "bg-orange/12 text-orange",
  purple: "bg-purple/12 text-purple",
  red: "bg-red/12 text-red",
  teal: "bg-teal/12 text-teal",
  gray: "bg-elevated text-sub",
};

export function StatCard({
  label,
  value,
  icon,
  tone = "blue",
  sub,
  action,
  className,
}: {
  label: string;
  value: ReactNode;
  icon: IconName;
  tone?: StatTone;
  sub?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-card",
        "transition-[border-color,box-shadow] duration-300",
        "hover:border-accent-soft-strong hover:shadow-glow",
        className
      )}
    >
      {/* Violet wash that surfaces on hover — depth without a colour shift. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-accent/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative flex items-start justify-between">
        <span className={cn("flex size-10 items-center justify-center rounded-xl", iconTones[tone])}>
          <Icon name={icon} size={18} />
        </span>
        {action}
      </div>
      <div className="relative mt-5">
        <div className="tabular font-display text-[30px] font-bold leading-none tracking-[-0.03em] text-ink">
          {value}
        </div>
        <div className="mt-2 text-[12.5px] font-medium text-sub">{label}</div>
        {sub && <div className="mt-2 text-[12.5px] text-faint">{sub}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  className,
  tone = "blue",
  label,
}: {
  value: number;
  className?: string;
  tone?: "blue" | "green" | "orange" | "purple";
  /** Accessible name. Without it the bar is decorative and hidden from AT. */
  label?: string;
}) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const tones: Record<string, string> = {
    blue: "bg-gradient-to-r from-[var(--grad-1)] to-[var(--grad-2)]",
    green: "bg-green",
    orange: "bg-orange",
    purple: "bg-purple",
  };

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-elevated", className)}
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(pct) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tones[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-elevated px-2.5 py-1",
        "text-[12.5px] font-medium text-sub",
        className
      )}
    >
      {children}
    </span>
  );
}
