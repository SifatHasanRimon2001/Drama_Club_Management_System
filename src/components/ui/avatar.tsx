import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const palette = [
  "bg-blue/15 text-blue",
  "bg-purple/15 text-purple",
  "bg-teal/15 text-teal",
  "bg-orange/15 text-[#c93400]",
  "bg-pink/15 text-pink",
  "bg-indigo/15 text-indigo",
  "bg-green/15 text-[#248a3d]",
  "bg-red/15 text-red",
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
        className={cn("rounded-full object-cover bg-black/5", className)}
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
