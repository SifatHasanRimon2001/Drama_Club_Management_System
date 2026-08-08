"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const autoFocus =
        panel.querySelector<HTMLElement>('[data-autofocus], input, textarea, select');
      (autoFocus ?? panel.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      // Restore focus to the element that opened the dialog
      requestAnimationFrame(() => lastFocusedRef.current?.focus());
    };
  }, [open, onKeyDown]);

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
      aria-labelledby={titleId}
    >
      <div
        className="animate-fade absolute inset-0 bg-black/35 backdrop-blur-[6px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={cn(
          "animate-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-sheet sm:rounded-3xl",
          "dark:bg-[#0f172a]",
          sizes[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6 dark:border-white/10">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-semibold tracking-tight text-ink dark:text-slate-100">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[13px] text-sub dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-sub transition hover:bg-black/10 active:scale-95 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
            aria-label="Close dialog"
          >
            <Icon name="close" size={15} />
          </button>
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-white/70 px-5 py-3.5 backdrop-blur sm:px-6 dark:border-white/10 dark:bg-[#0f172a]/80">
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
            disabled={loading}
            className="inline-flex h-11 items-center justify-center rounded-full bg-black/[0.05] px-5 text-sm font-medium text-ink transition hover:bg-black/10 disabled:opacity-50 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-white transition active:scale-[0.98] disabled:opacity-50",
              tone === "danger"
                ? "bg-red hover:bg-[#e0362b]"
                : "bg-gradient-to-br from-gold-light via-gold to-[#1e40af] font-bold text-white hover:brightness-110"
            )}
          >
            {loading && (
              <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
            )}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[15px] leading-relaxed text-sub dark:text-slate-400">{message}</p>
    </Modal>
  );
}
