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
  blue: "bg-blue/10 text-blue dark:text-blue-300",
  green: "bg-green/12 text-[#248a3d] dark:text-green-400",
  red: "bg-red/10 text-red dark:text-red-400",
  orange: "bg-orange/12 text-[#c93400] dark:text-orange-400",
  yellow: "bg-yellow/20 text-[#8a6d00] dark:text-yellow-300",
  purple: "bg-purple/10 text-purple dark:text-purple-300",
  gray: "bg-black/[0.06] text-sub dark:bg-white/10 dark:text-gray-400",
  teal: "bg-teal/10 text-teal dark:text-teal-300",
  pink: "bg-pink/10 text-pink dark:text-pink-400",
  indigo: "bg-indigo/10 text-indigo dark:text-indigo-300",
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none whitespace-nowrap",
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