import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared card surface — premium, clean, Apple-inspired.
 */
export const cardSurface =
  "rounded-xl border border-gray-200/80 bg-white shadow-card dark:bg-[#1e293b] dark:border-white/8";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(cardSurface, className)} {...props} />;
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
        "font-display min-w-0 text-[17px] font-semibold leading-snug tracking-tight text-ink dark:text-slate-100",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardSubtitle({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[13.5px] text-sub dark:text-slate-400", className)} {...props} />;
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 p-5 sm:p-6 pb-0",
        className
      )}
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
        "flex items-center justify-between gap-3 border-t border-gray-100 px-5 sm:px-6 py-4",
        "dark:border-white/8",
        className
      )}
      {...props}
    />
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink dark:text-slate-100">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-[13.5px] text-sub dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
