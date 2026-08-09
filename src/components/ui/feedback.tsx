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
      <p className="text-[13.5px]">{label}</p>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-xl bg-gray-100 dark:bg-white/8", className)}
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
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center dark:border-white/10",
        className
      )}
    >
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink  " aria-hidden="true">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="text-[15px] font-semibold text-ink dark:text-slate-100">{title}</h3>
      {message && (
        <p className="mt-1 max-w-sm text-[13.5px] text-sub dark:text-slate-400">{message}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
