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

const baseField =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint " +
  "transition-all duration-150 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 " +
  "disabled:opacity-50 dark:bg-[#1e293b] dark:text-slate-100 dark:border-white/10 dark:focus:border-blue-400 dark:focus:ring-blue-400/10";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseField, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(baseField, "resize-y min-h-24", className)} {...props} />
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
    className={cn(baseField, "appearance-none pr-9 bg-no-repeat bg-[right_0.75rem_center]", className)}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
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
        ...(error ? { "aria-invalid": true, "aria-describedby": errorId } : hint ? { "aria-describedby": hintId } : {}),
      })
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={controlId} className="block text-[13px] font-medium text-sub dark:text-slate-400">
          {label}
          {optional && <span className="ml-1 text-[12px] font-normal text-faint">(optional)</span>}
        </label>
      )}
      {control}
      {error ? (
        <p id={errorId} role="alert" className="text-[13px] text-red">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-faint">
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
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </span>
      <input
        type="search"
        aria-label={ariaLabel}
        className={cn(baseField, "pl-10 rounded-xl", className)}
        {...props}
      />
    </div>
  );
}
