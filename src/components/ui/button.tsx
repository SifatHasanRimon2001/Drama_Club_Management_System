"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
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
  /** Renders the icon after the label instead of before it. */
  iconTrailing?: boolean;
}

/**
 * Variants are written against design tokens only, so a single palette change
 * in globals.css restyles every button in the product. Each one carries the
 * same tactile contract: lift or brighten on hover, press in on active,
 * violet ring on keyboard focus.
 */
const variantClasses: Record<Variant, string> = {
  // Vivid violet with a soft halo. `sheen` sweeps a highlight across on hover.
  primary:
    "sheen bg-accent text-on-accent font-semibold shadow-[0_2px_12px_var(--color-accent-soft-strong)] " +
    "hover:bg-accent-hover hover:shadow-gold active:scale-[0.98]",
  // Outlined glass — reads as secondary without becoming invisible on black.
  secondary:
    "bg-card text-ink border border-line-strong hover:border-accent hover:bg-elevated " +
    "active:scale-[0.98] shadow-card",
  ghost:
    "text-accent-ink hover:bg-accent-soft hover:text-accent active:scale-[0.98]",
  subtle:
    "bg-elevated text-ink border border-line hover:border-line-strong hover:bg-card active:scale-[0.98]",
  danger:
    "bg-red text-white font-semibold hover:brightness-110 active:scale-[0.98] " +
    "shadow-[0_2px_12px_rgba(225,29,72,0.28)] dark:text-canvas",
};

/** Heights meet a 36px minimum so every button is a comfortable touch target. */
const sizeClasses: Record<Size, string> = {
  xs: "h-9 px-3.5 text-[13px] rounded-lg gap-1.5",
  sm: "h-9 px-4 text-[13px] rounded-lg gap-1.5",
  md: "h-10 px-5 text-[13.5px] rounded-xl gap-2",
  lg: "h-12 px-7 text-[14.5px] rounded-xl gap-2",
};

/** Shared shell so a button and a link-styled-as-button can never drift apart. */
function buttonClasses(variant: Variant, size: Size, full?: boolean, className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium whitespace-nowrap select-none",
    "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
    "disabled:opacity-45 disabled:pointer-events-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    variantClasses[variant],
    sizeClasses[size],
    full && "w-full",
    className
  );
}

function ButtonInner({
  loading,
  icon,
  iconTrailing,
  size,
  children,
}: {
  loading?: boolean;
  icon?: IconName;
  iconTrailing?: boolean;
  size: Size;
  children: ReactNode;
}) {
  const glyph =
    icon && !loading ? <Icon name={icon} size={size === "sm" || size === "xs" ? 14 : 16} /> : null;
  return (
    <>
      {loading && (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {!iconTrailing && glyph}
      {children}
      {iconTrailing && glyph}
    </>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      full,
      disabled,
      icon,
      iconTrailing,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={buttonClasses(variant, size, full, className)}
        {...props}
      >
        <ButtonInner loading={loading} icon={icon} iconTrailing={iconTrailing} size={size}>
          {children}
        </ButtonInner>
      </button>
    );
  }
);
Button.displayName = "Button";

/**
 * A navigation control that looks like a button.
 *
 * Kept as a separate component rather than an `href` prop on Button so the
 * rendered element is always a real anchor — navigation must be a link, so it
 * opens in a new tab on middle-click, shows a target on hover, and is announced
 * as a link rather than a button.
 */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  full,
  icon,
  iconTrailing,
  className,
  children,
  ...props
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  icon?: IconName;
  iconTrailing?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<React.ComponentPropsWithoutRef<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={buttonClasses(variant, size, full, className)} {...props}>
      <ButtonInner icon={icon} iconTrailing={iconTrailing} size={size}>
        {children}
      </ButtonInner>
    </Link>
  );
}

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
        "inline-flex size-10 items-center justify-center rounded-xl text-sub transition-all duration-200",
        "hover:bg-elevated hover:text-ink active:scale-95",
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
