"use client";

import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";

/**
 * One field surface shared by input / textarea / select.
 *
 * `field-focus` (globals.css) supplies the violet ring; the native outline is
 * suppressed for these three elements so the two treatments never double up.
 * Minimum height is 44px — comfortable on touch, and it stops dense admin
 * forms from feeling cramped.
 */
const baseField =
  "w-full rounded-xl border border-line-strong bg-elevated px-3.5 py-2.5 text-[14px] text-ink " +
  "min-h-11 placeholder:text-faint field-focus " +
  "transition-[border-color,box-shadow,background-color] duration-200 " +
  "hover:border-line-strong disabled:opacity-50 disabled:cursor-not-allowed " +
  "aria-[invalid=true]:border-red aria-[invalid=true]:shadow-[0_0_0_4px_var(--color-red)]/15";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseField, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(baseField, "min-h-28 resize-y", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
    onChange?: (value: string) => void;
  }
>(({ className, children, onChange, ...props }, ref) => (
  <select
    ref={ref}
    onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    className={cn(
      baseField,
      "cursor-pointer appearance-none bg-[right_0.85rem_center] bg-no-repeat pr-10",
      className
    )}
    style={{
      // currentColor is not available to a background image, so the chevron is
      // drawn in the muted token colour that matches `text-faint` in both themes.
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23736c87' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
    }}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

const CONTROL_NAMES = new Set(["Input", "Select", "Textarea"]);

function isFormControl(node: ReactNode): node is ReactElement {
  if (!isValidElement(node)) return false;
  if (typeof node.type === "string") {
    return ["input", "select", "textarea"].includes(node.type);
  }
  const type = node.type as { displayName?: string };
  return typeof type === "function" || typeof type === "object"
    ? CONTROL_NAMES.has(type.displayName ?? "")
    : false;
}

/**
 * Label + control + hint/error, wired together for assistive tech: the label
 * is bound with htmlFor/id, and an error is announced via aria-describedby and
 * role="alert" rather than by colour alone.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const autoId = useId();
  const controlId = htmlFor ?? autoId;
  const errorId = `${controlId}-error`;
  const hintId = `${controlId}-hint`;

  const control = isFormControl(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: controlId,
        ...(error
          ? { "aria-invalid": true, "aria-describedby": errorId }
          : hint
            ? { "aria-describedby": hintId }
            : {}),
      })
    : children;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label
          htmlFor={controlId}
          className="block text-[12.5px] font-semibold tracking-[0.01em] text-sub"
        >
          {label}
          {optional && <span className="ml-1.5 font-normal text-faint">(optional)</span>}
        </label>
      )}
      {control}
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-[12.5px] text-red">
          <Icon name="warn" size={13} className="shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[12.5px] text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SearchInput({
  className,
  "aria-label": ariaLabel = "Search",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <span
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
        aria-hidden="true"
      >
        <Icon name="search" size={16} />
      </span>
      <input
        type="search"
        aria-label={ariaLabel}
        className={cn(baseField, "pl-10")}
        {...props}
      />
    </div>
  );
}
