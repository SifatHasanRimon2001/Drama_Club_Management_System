import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * ClubLogo — the club's emblem: comedy/tragedy masks on a gold medallion,
 * framed by a gold rod and two velvet curtain swags. Crisp SVG at any size.
 */
export function ClubLogo({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId();
  const gold = `g-${uid}`;
  const velvet = `v-${uid}`;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 56 56" className="size-full" fill="none">
        <defs>
          <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#93c5fd" />
            <stop offset="0.5" stopColor="#2563eb" />
            <stop offset="1" stopColor="#1e40af" />
          </linearGradient>
          <linearGradient id={velvet} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1e293b" />
            <stop offset="1" stopColor="#0f172a" />
          </linearGradient>
        </defs>

        {/* Gold rod + finials */}
        <rect x="6" y="4.5" width="44" height="3" rx="1.5" fill={`url(#${gold})`} />
        <circle cx="5.5" cy="6" r="2.2" fill="#2563eb" />
        <circle cx="50.5" cy="6" r="2.2" fill="#2563eb" />

        {/* Velvet curtain swags behind the medallion */}
        <path d="M8 7.5 C15 14 17 22 12.5 31 L8 31 Z" fill={`url(#${velvet})`} />
        <path d="M48 7.5 C41 14 39 22 43.5 31 L48 31 Z" fill={`url(#${velvet})`} />

        {/* Gold medallion */}
        <circle cx="28" cy="33" r="17.5" fill={`url(#${gold})`} />
        <circle
          cx="28"
          cy="33"
          r="15.2"
          stroke="rgba(15, 23, 42, 0.28)"
          strokeWidth="1.2"
          fill="none"
        />

        {/* Masks — tragedy (upstage left), comedy (downstage right) */}
        <circle cx="23" cy="30" r="5.5" fill="#0f172a" />
        <circle cx="33" cy="35" r="5.5" fill="#0f172a" />
        <circle cx="20.5" cy="28" r="0.8" fill="#e2e8f0" />
        <circle cx="25.5" cy="28" r="0.8" fill="#e2e8f0" />
        <path
          d="M20.5 33c0.8-1.6 4-1.6 5 0"
          stroke="#e2e8f0"
          strokeWidth="0.9"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="31" cy="33" r="0.8" fill="#e2e8f0" />
        <circle cx="35" cy="33" r="0.8" fill="#e2e8f0" />
        <path
          d="M31 38.5c0.9 1.5 3.5 1.5 4.4 0"
          stroke="#e2e8f0"
          strokeWidth="0.9"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
