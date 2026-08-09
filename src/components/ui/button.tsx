"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  full?: boolean;
  icon?: IconName;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-white font-semibold hover:bg-accent-hover active:bg-accent-hover active:scale-[0.98] shadow-sm hover:shadow-md dark:text-on-accent",
  secondary:
    "bg-white text-ink border border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] shadow-sm dark:bg-card dark:border-white/10 dark:hover:bg-white/10",
  ghost: "text-accent hover:bg-accent-soft active:scale-[0.98] dark:text-accent dark:hover:bg-accent-soft",
  subtle: "bg-gray-100 text-ink hover:bg-gray-200 active:scale-[0.98] dark:bg-white/10 dark:hover:bg-white/15",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] shadow-sm hover:shadow-md dark:bg-red dark:text-on-accent dark:hover:bg-red-500",
};

const sizeClasses: Record<Size, string> = {
  xs: "h-8 px-3.5 text-[13px] rounded-lg gap-1",
  sm: "h-9 px-4 text-[13px] rounded-lg gap-1.5",
  md: "h-10 px-5 text-sm rounded-lg gap-2",
  lg: "h-11 px-6 text-sm rounded-lg gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading, full, disabled, icon, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-150 select-none",
          "disabled:opacity-50 disabled:pointer-events-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          variantClasses[variant],
          sizeClasses[size],
          full && "w-full",
          className
        )}
        {...props}
      >
        {loading && (
          <span
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {icon && <Icon name={icon} size={size === "sm" || size === "xs" ? 14 : 16} />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export function IconButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-lg transition-all",
        "size-10 text-ink hover:bg-gray-100 active:scale-95",
        "dark:text-slate-200 dark:hover:bg-white/10",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className
      )}
      {...props}
    />
  );
}

export function ActionIcon({
  icon,
  label,
  variant = "secondary",
  size = "sm",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
  variant?: Variant;
  size?: Size;
}) {
  return (
    <Button
      aria-label={label}
      title={label}
      variant={variant}
      size={size}
      className={cn("px-2.5", className)}
      {...props}
    >
      <Icon name={icon} size={size === "xs" ? 13 : 15} />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
