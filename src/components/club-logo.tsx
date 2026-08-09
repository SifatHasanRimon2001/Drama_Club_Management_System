import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * ClubLogo — "3·2·1 cut" media player mark on a vivid blue→purple
 * rounded square, Nokia phone gallery/player style.
 * Premium SVG at any size.
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
  const glow = `h-${uid}`;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 56 56" className="size-full" fill="none">
        <defs>
          <linearGradient id={steel} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4fc1ff" />
            <stop offset="0.55" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id={glow} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Rounded square tile */}
        <rect x="2" y="2" width="52" height="52" rx="11" fill={`url(#${steel})`} />
        <rect x="2" y="2" width="52" height="26" rx="11" fill={`url(#${glow})`} />
        <rect
          x="3.5"
          y="3.5"
          width="49"
          height="49"
          rx="9.5"
          stroke="rgba(255, 255, 255, 0.28)"
          strokeWidth="1.2"
          fill="none"
        />

        {/* Play triangle (media player) */}
        <path
          d="M22.5 18.5 L41 28 L22.5 37.5 Z"
          fill="#ffffff"
          fillOpacity="0.95"
          stroke="#ffffff"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        {/* 3·2·1 countdown dashes */}
        <rect x="16" y="42" width="6.5" height="3.4" rx="1.7" fill="#ffffff" fillOpacity="0.95" />
        <rect x="24.75" y="42" width="6.5" height="3.4" rx="1.7" fill="#ffffff" fillOpacity="0.7" />
        <rect x="33.5" y="42" width="6.5" height="3.4" rx="1.7" fill="#ffffff" fillOpacity="0.45" />
      </svg>
    </span>
  );
}
