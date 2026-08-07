import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        {icon && (
          <span className="flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Icon name={icon} size={22} />
          </span>
        )}
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-ink dark:text-gray-100">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-[13.5px] text-sub dark:text-gray-400">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
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
      <h3 className="text-[16px] font-semibold text-ink dark:text-gray-100">
        Access Restricted
      </h3>
      <p className="mt-1 max-w-sm text-sm text-sub dark:text-gray-400">{message}</p>
    </div>
  );
}
