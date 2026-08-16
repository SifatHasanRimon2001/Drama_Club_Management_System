import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

/**
 * Initial-avatar tints, deterministically assigned per name.
 *
 * Held to the violet end of the spectrum — violet, purple, indigo, pink — so a
 * wall of member avatars still reads as one palette instead of a fruit salad.
 * Teal is the single cool outlier that keeps large lists distinguishable.
 */
const palette = [
  "bg-accent-soft-strong text-accent-ink",
  "bg-purple/15 text-purple",
  "bg-indigo/15 text-indigo",
  "bg-pink/15 text-pink",
  "bg-teal/15 text-teal",
  "bg-accent/15 text-accent",
];

function hashIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % palette.length;
}

export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const text = initials(name || "?");
  const bg = palette[hashIndex(name || "?")];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || ""}
        width={size}
        height={size}
        className={cn("rounded-full bg-elevated object-cover ring-1 ring-line", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        bg,
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {text}
    </span>
  );
}
