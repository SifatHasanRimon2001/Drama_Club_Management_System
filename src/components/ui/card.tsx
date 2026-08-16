import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The single card surface for the whole product.
 *
 * Token-only so it inverts cleanly between themes: a charcoal panel on the
 * near-black canvas in dark, a white panel on off-white in light. `interactive`
 * adds the violet lift for cards that are themselves a link or button — static
 * cards should not animate, since a hover response implies clickability.
 */
export const cardSurface =
  "rounded-2xl border border-line bg-card shadow-card";

export function Card({
  className,
  interactive,
  glow,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  /** Lift + violet glow on hover. Use only when the card is clickable. */
  interactive?: boolean;
  /** Adds the thin luminous top edge that makes a panel read as physical. */
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        cardSurface,
        interactive && "card-glow cursor-pointer",
        glow && "edge-glow",
        className
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display min-w-0 text-[17px] font-semibold leading-snug tracking-[-0.02em] text-ink",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardSubtitle({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[13.5px] leading-relaxed text-sub", className)} {...props} />;
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 p-5 pb-0 sm:p-6 sm:pb-0", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6",
        className
      )}
      {...props}
    />
  );
}

/**
 * Glass panel for content that floats over an ambient/gradient backdrop —
 * hero cards, overlays. Falls back to a solid card where backdrop-filter is
 * unavailable (the `bg-card/70` underlay guarantees legible contrast).
 */
export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass rounded-2xl border border-line-strong bg-card/70 shadow-pop",
        className
      )}
      {...props}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  align = "start",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4",
        align === "center" && "flex-col items-center justify-center text-center",
        className
      )}
    >
      <div className={cn("min-w-0", align === "center" && "flex flex-col items-center")}>
        {eyebrow && <p className="theatre-eyebrow mb-3">{eyebrow}</p>}
        <h2 className="font-display text-[24px] font-bold tracking-[-0.03em] text-ink sm:text-[28px]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-sub">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
