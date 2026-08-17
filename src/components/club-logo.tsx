import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * ClubLogo — a violet rounded-square tile carrying a "spotlight on stage" mark.
 *
 * The mark is a single beam of light widening from a lamp at the top down onto
 * a stage floor. It reads as theatre without resorting to the comedy/tragedy
 * masks every drama club uses, and it holds up at 22px in the nav because it is
 * three chunky shapes and nothing else.
 *
 * The beam is drawn with a top-to-bottom opacity fade, so the light appears to
 * fall rather than being a flat triangle — that gradient is what separates it
 * from a generic "play" arrow.
 *
 * Purely decorative: the accessible name always comes from adjacent text, so
 * the whole thing is aria-hidden.
 */
export function ClubLogo({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  // useId keeps gradient ids unique — several logos render on the same page,
  // and duplicate ids would make them all inherit the first one's fills.
  const uid = useId();
  const tile = `tile-${uid}`;
  const gloss = `gloss-${uid}`;
  const beam = `beam-${uid}`;
  const lampGlow = `lamp-${uid}`;

  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 56 56" className="size-full" fill="none">
        <defs>
          {/* Violet range: light violet → brand violet → deep violet. */}
          <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a78bfa" />
            <stop offset="0.5" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#6d28d9" />
          </linearGradient>

          {/* Top sheen that gives the tile its glassy, physical feel. */}
          <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Light falls off toward the stage. */}
          <linearGradient id={beam} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.28" />
          </linearGradient>

          <radialGradient id={lampGlow}>
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Rounded square tile */}
        <rect x="2" y="2" width="52" height="52" rx="14" fill={`url(#${tile})`} />
        <rect x="2" y="2" width="52" height="27" rx="14" fill={`url(#${gloss})`} />
        {/* Inner hairline — reads as a bevelled edge at large sizes. */}
        <rect
          x="3.25"
          y="3.25"
          width="49.5"
          height="49.5"
          rx="12.75"
          stroke="#ffffff"
          strokeOpacity="0.3"
          strokeWidth="1.2"
          fill="none"
        />

        {/* Halo around the lamp */}
        <circle cx="18" cy="16" r="9.5" fill={`url(#${lampGlow})`} />

        {/* Spotlight beam, thrown from the upper left across the stage.
            The tilt is doing real work: a centred cone with a lamp on top
            silhouettes as a chess pawn, whereas an angled beam can only read
            as light travelling.

            The two edges open in opposite directions from the lamp — the left
            edge leans slightly left, the right edge sweeps well right. Letting
            both lean the same way (the obvious way to draw a tilted triangle)
            collapses it into a thin shard with an empty corner beneath. */}
        <path d="M18 19 L14.5 40.5 L42.5 40.5 Z" fill={`url(#${beam})`} />

        {/* The lamp itself */}
        <circle cx="18" cy="16" r="3.5" fill="#ffffff" />

        {/* Stage floor */}
        <rect x="11" y="43" width="34" height="4.5" rx="2.25" fill="#ffffff" fillOpacity="0.95" />
      </svg>
    </span>
  );
}
