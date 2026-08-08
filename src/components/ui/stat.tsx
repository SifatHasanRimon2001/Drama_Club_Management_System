import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";

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
  tone?: "blue" | "green" | "orange" | "purple" | "red" | "teal" | "gray";
  sub?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
    red: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400",
    teal: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400",
    gray: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-slate-400",
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200/80 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover",
        "dark:bg-[#1e293b] dark:border-white/8",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn("flex size-10 items-center justify-center rounded-xl", tones[tone])}>
          <Icon name={icon} size={18} />
        </span>
        {action}
      </div>
      <div className="mt-4">
        <div className="font-display text-[28px] font-bold leading-none tracking-tight text-ink dark:text-slate-100">
          {value}
        </div>
        <div className="mt-1.5 text-[13px] font-medium text-sub dark:text-slate-400">{label}</div>
        {sub && <div className="mt-2 text-[13px] text-faint">{sub}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  className,
  tone = "blue",
}: {
  value: number;
  className?: string;
  tone?: "blue" | "green" | "orange" | "purple";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    orange: "bg-orange-500",
    purple: "bg-purple-500",
  };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[12.5px] font-medium text-sub",
        "dark:bg-white/10 dark:text-slate-300",
        className
      )}
    >
      {children}
    </span>
  );
}
