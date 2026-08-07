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
    "bg-accent text-white hover:bg-accent-hover active:scale-[0.98] shadow-[0_1px_2px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,113,227,0.25)]",
  secondary:
    "bg-white text-ink border border-line hover:bg-black/[0.03] active:scale-[0.98] shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
  ghost: "text-accent hover:bg-accent-soft active:scale-[0.98]",
  subtle: "bg-black/[0.05] text-ink hover:bg-black/[0.08] active:scale-[0.98]",
  danger:
    "bg-red text-white hover:bg-[#e0362b] active:scale-[0.98] shadow-[0_1px_2px_rgba(0,0,0,0.12),0_4px_12px_rgba(255,59,48,0.25)]",
};

const sizeClasses: Record<Size, string> = {
  xs: "h-8 px-3 text-[13px] rounded-full gap-1",
  sm: "h-9 px-4 text-sm rounded-full gap-1.5",
  md: "h-11 px-5 text-sm rounded-full gap-2",
  lg: "h-12 px-7 text-base rounded-full gap-2",
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
          "inline-flex items-center justify-center font-medium transition-all duration-150 select-none",
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
        {icon && <Icon name={icon} size={size === "sm" || size === "xs" ? 15 : 17} />}
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
        "inline-flex items-center justify-center rounded-full transition-all",
        "size-10 text-ink hover:bg-black/[0.06] active:scale-95",
        "dark:text-gray-200 dark:hover:bg-white/10",
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
