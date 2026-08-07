"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-fade absolute inset-0 bg-black/35 backdrop-blur-[6px]"
        onClick={onClose}
      />
      <div
        className={cn(
          "animate-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-sheet sm:rounded-3xl",
          "dark:bg-[#1c1c1e]",
          sizes[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink dark:text-gray-100">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[13px] text-sub dark:text-gray-400">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-sub transition hover:bg-black/10 active:scale-95 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
            aria-label="Close"
          >
            <Icon name="close" size={15} />
          </button>
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-white/70 px-5 py-3.5 backdrop-blur sm:px-6 dark:border-white/10 dark:bg-[#1c1c1e]/80">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  tone = "danger",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-full bg-black/[0.05] px-5 text-sm font-medium text-ink transition hover:bg-black/10 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-white transition active:scale-[0.98] disabled:opacity-50",
              tone === "danger"
                ? "bg-red hover:bg-[#e0362b]"
                : "bg-accent hover:bg-accent-hover"
            )}
          >
            {loading && (
              <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[15px] leading-relaxed text-sub dark:text-gray-400">{message}</p>
    </Modal>
  );
}
