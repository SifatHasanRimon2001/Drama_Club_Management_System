import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Shared page header used by every dashboard page.
 *
 * Fixed grid position: icon | title/subtitle | actions, all wrapping to a
 * single column on phones and two rows on tablets/desktop.
 */
export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
  className,
}: {
  icon?: IconName;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-center justify-between gap-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        {icon && (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-accent-soft text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
            <Icon name={icon} size={22} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-ink dark:text-slate-100">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-[13.5px] text-sub dark:text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/**
 * Public page intro (eyebrow + title + subtitle + optional actions).
 *
 * Used on every marketing/content page so the hero block occupies the same
 * grid position on phone, tablet and desktop.
 */
export function PageIntro({
  eyebrow,
  title,
  subtitle,
  actions,
  align = "start",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-6",
        align === "center" && "flex-col items-center text-center",
        className
      )}
    >
      <div className={cn("min-w-0 max-w-3xl", align === "center" && "flex flex-col items-center")}>
        {eyebrow && (
          <p className="theatre-eyebrow text-accent">{eyebrow}</p>
        )}
        <h1 className="display-title mt-4 text-ink dark:text-[#faf4e6]">{title}</h1>
        {subtitle && (
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-sub sm:text-[19px] dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/** Consistent "back to X" link used above detail pages. */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-[13.5px] font-medium text-sub transition hover:text-ink dark:text-slate-400 dark:hover:text-slate-100",
        className
      )}
    >
      <Icon name="chevron-left" size={14} />
      {children}
    </Link>
  );
}

export function PermissionGate({
  allowed,
  children,
  message = "You don't have permission to view this.",
}: {
  allowed: boolean;
  children: ReactNode;
  message?: string;
}) {
  if (allowed) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong/60 px-6 py-16 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-red/10 text-red">
        <Icon name="lock" size={26} />
      </span>
      <h3 className="text-[16px] font-semibold text-ink dark:text-slate-100">
        Access Restricted
      </h3>
      <p className="mt-1 max-w-sm text-sm text-sub dark:text-slate-400">{message}</p>
    </div>
  );
}
