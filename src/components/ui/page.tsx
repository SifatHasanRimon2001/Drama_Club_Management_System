import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";

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
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-accent-soft-strong bg-accent-soft text-accent-ink">
            <Icon name={icon} size={20} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-[25px] font-bold leading-tight tracking-[-0.03em] text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-[13.5px] text-sub">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

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
          <p className="theatre-eyebrow">{eyebrow}</p>
        )}
        <h1 className="display-title mt-5 text-ink">{title}</h1>
        {subtitle && (
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-sub sm:text-[17.5px]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

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
        "group inline-flex items-center gap-1.5 text-[13.5px] font-medium text-sub transition hover:text-accent-ink",
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-card/40 px-6 py-16 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-red/12 text-red">
        <Icon name="lock" size={24} />
      </span>
      <h3 className="text-[15.5px] font-semibold text-ink">
        Access Restricted
      </h3>
      <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-sub">{message}</p>
    </div>
  );
}
