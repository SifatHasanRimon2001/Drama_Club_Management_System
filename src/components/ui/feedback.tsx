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
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sub"
    >
      <Spinner className="text-accent" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-2xl bg-black/[0.06] dark:bg-white/10", className)}
    />
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
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong/60 px-6 py-14 text-center",
        className
      )}
    >
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent" aria-hidden="true">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="text-[16px] font-semibold text-ink dark:text-slate-100">{title}</h3>
      {message && (
        <p className="mt-1 max-w-sm text-sm text-sub dark:text-slate-400">{message}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
