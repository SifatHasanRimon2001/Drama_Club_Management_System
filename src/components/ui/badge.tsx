import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone =
  | "blue"
  | "green"
  | "red"
  | "orange"
  | "yellow"
  | "purple"
  | "gray"
  | "teal"
  | "pink"
  | "indigo";

const tones: Record<Tone, string> = {
  blue: "bg-accent-soft-strong text-accent-ink",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  red: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
  gray: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-slate-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400",
  pink: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400",
};

export function Badge({
  tone = "gray",
  dot,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-none whitespace-nowrap",
        tones[tone],
        className
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusPill({
  value,
  children,
  className,
  ...rest
}: { value: string; children?: ReactNode; className?: string } & Omit<
  HTMLAttributes<HTMLSpanElement>,
  "children"
>) {
  return (
    <Badge tone={toneFor(value)} className={className} {...rest}>
      {children ?? prettyLabel(value)}
    </Badge>
  );
}

export function prettyLabel(value: string): string {
  return (value || "")
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function toneFor(value: string): Tone {
  const v = (value || "").toUpperCase();
  if (["ACTIVE", "APPROVED", "ACCEPTED", "DONE", "CONVERTED", "LIVE", "GOING", "UPCOMING"].includes(v)) return "green";
  if (["PENDING", "SUBMITTED", "UNDER_REVIEW", "SCHEDULED", "IN_PROGRESS", "MAYBE", "PENDING_APPROVAL"].includes(v)) return "orange";
  if (["SUSPENDED", "REJECTED", "CANCELLED", "NOT_GOING", "INACTIVE", "DISSOLVED"].includes(v)) return "red";
  if (["DRAFT", "TODO"].includes(v)) return "gray";
  if (["ALUMNI", "CLOSED", "COMPLETED"].includes(v)) return "purple";
  if (["ONGOING"].includes(v)) return "blue";
  return "blue";
}
