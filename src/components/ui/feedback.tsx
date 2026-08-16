import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      className={cn(
        "inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
    >
      <span className="sr-only">Loading</span>
    </span>
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-sub"
    >
      <span className="relative flex size-12 items-center justify-center">
        {/* Violet halo behind the spinner — the loading state gets the same
            ambient treatment as the rest of the product. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-pulse-glow rounded-full bg-accent/20 blur-xl"
        />
        <Spinner className="relative text-accent" />
      </span>
      <p className="text-[13.5px]">{label}</p>
    </div>
  );
}

/**
 * Skeleton placeholder. Uses a travelling shimmer rather than a pulse — on a
 * near-black canvas a fading block is easy to mistake for real dim content.
 */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("shimmer rounded-xl", className)} />;
}

/** Skeleton in the shape of a card, for list/grid loading states. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-2xl border border-line bg-card p-5", className)}
    >
      <SkeletonBlock className="size-10 rounded-xl" />
      <SkeletonBlock className="mt-5 h-6 w-2/3" />
      <SkeletonBlock className="mt-3 h-4 w-1/2" />
    </div>
  );
}

/** Skeleton rows for tables and dense lists. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

/**
 * Shared shell for the "nothing here" family of states, so empty and error
 * read as siblings rather than as two unrelated designs.
 */
function StatePanel({
  icon,
  iconClass,
  title,
  message,
  action,
  className,
  role,
}: {
  icon: IconName;
  iconClass: string;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
  role?: "alert";
}) {
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong",
        "bg-card/40 px-6 py-14 text-center",
        className
      )}
    >
      <span
        className={cn("mb-4 flex size-14 items-center justify-center rounded-2xl", iconClass)}
        aria-hidden="true"
      >
        <Icon name={icon} size={24} />
      </span>
      <h3 className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-sub">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon = "gallery",
  title,
  message,
  action,
  className,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <StatePanel
      icon={icon}
      iconClass="bg-accent-soft text-accent-ink"
      title={title}
      message={message}
      action={action}
      className={className}
    />
  );
}

/**
 * Failure state. Announced via role="alert" so a screen reader hears it when a
 * request fails, and always paired with a retry affordance where one exists.
 */
export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this right now. Please try again.",
  action,
  className,
}: {
  title?: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <StatePanel
      role="alert"
      icon="warn"
      iconClass="bg-red/12 text-red"
      title={title}
      message={message}
      action={action}
      className={className}
    />
  );
}
