import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * ClubLogo — the club's emblem: comedy/tragedy masks on a steel-blue
 * medallion. Crisp SVG at any size.
 */
export function ClubLogo({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId();
  const steel = `g-${uid}`;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 56 56" className="size-full" fill="none">
        <defs>
          <linearGradient id={steel} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#93c5fd" />
            <stop offset="0.5" stopColor="#2563eb" />
            <stop offset="1" stopColor="#1e40af" />
          </linearGradient>
        </defs>

        {/* Medallion */}
        <circle cx="28" cy="28" r="25" fill={`url(#${steel})`} />
        <circle
          cx="28"
          cy="28"
          r="22.5"
          stroke="rgba(15, 23, 42, 0.28)"
          strokeWidth="1.2"
          fill="none"
        />

        {/* Masks — tragedy (upstage left), comedy (downstage right) */}
        <circle cx="23" cy="26" r="5.5" fill="#0f172a" />
        <circle cx="33" cy="31" r="5.5" fill="#0f172a" />
        <circle cx="20.5" cy="24" r="0.8" fill="#e2e8f0" />
        <circle cx="25.5" cy="24" r="0.8" fill="#e2e8f0" />
        <path
          d="M20.5 29c0.8-1.6 4-1.6 5 0"
          stroke="#e2e8f0"
          strokeWidth="0.9"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="31" cy="29" r="0.8" fill="#e2e8f0" />
        <circle cx="35" cy="29" r="0.8" fill="#e2e8f0" />
        <path
          d="M31 34.5c0.9 1.5 3.5 1.5 4.4 0"
          stroke="#e2e8f0"
          strokeWidth="0.9"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
