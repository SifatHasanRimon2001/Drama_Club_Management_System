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

/**
 * Badges are translucent tints over the card surface with a matching hairline,
 * rather than solid blocks of colour. On near-black that keeps status readable
 * without any pill competing with the violet accent for attention.
 *
 * `blue` is the accent tone — the palette's violet — because `toneFor()` maps
 * the app's neutral/among-friends states to it.
 */
const tones: Record<Tone, string> = {
  blue: "bg-accent-soft-strong text-accent-ink border-accent-soft-strong",
  green: "bg-green/12 text-green border-green/25",
  red: "bg-red/12 text-red border-red/25",
  orange: "bg-orange/12 text-orange border-orange/25",
  yellow: "bg-yellow/12 text-yellow border-yellow/25",
  purple: "bg-purple/12 text-purple border-purple/25",
  gray: "bg-elevated text-sub border-line-strong",
  teal: "bg-teal/12 text-teal border-teal/25",
  pink: "bg-pink/12 text-pink border-pink/25",
  indigo: "bg-indigo/12 text-indigo border-indigo/25",
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
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1",
        "text-[11.5px] font-semibold leading-none tracking-[0.01em]",
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
