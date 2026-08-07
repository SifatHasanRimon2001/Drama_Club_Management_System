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
    blue: "bg-accent-soft text-accent",
    green: "bg-green/12 text-[#248a3d] dark:text-green-400",
    orange: "bg-orange/12 text-[#c93400] dark:text-orange-400",
    purple: "bg-purple/12 text-purple dark:text-purple-300",
    red: "bg-red/10 text-red dark:text-red-400",
    teal: "bg-teal/10 text-teal dark:text-teal-300",
    gray: "bg-black/[0.06] text-sub dark:bg-white/10 dark:text-gray-400",
  };

  return (
    <div
      className={cn(
        "rounded-apple border border-line bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover",
        "dark:bg-[#1c1c1e] dark:border-white/10",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn("flex size-10 items-center justify-center rounded-xl", tones[tone])}>
          <Icon name={icon} size={19} />
        </span>
        {action}
      </div>
      <div className="mt-4">
        <div className="text-[28px] font-bold leading-none tracking-tight text-ink dark:text-gray-100">
          {value}
        </div>
        <div className="mt-1.5 text-[13px] font-medium text-sub dark:text-gray-400">{label}</div>
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
    blue: "bg-accent",
    green: "bg-green",
    orange: "bg-orange",
    purple: "bg-purple",
  };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10", className)}>
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
        "inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-1 text-[12.5px] font-medium text-sub",
        "dark:bg-white/10 dark:text-gray-300",
        className
      )}
    >
      {children}
    </span>
  );
}
