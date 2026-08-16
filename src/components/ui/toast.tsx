"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const kindStyles: Record<ToastKind, { icon: IconName; ring: string; iconColor: string }> = {
  success: { icon: "check", ring: "ring-emerald-200 dark:ring-emerald-500/40", iconColor: "bg-emerald-500 text-white" },
  error: { icon: "warn", ring: "ring-red-200 dark:ring-red-500/40", iconColor: "bg-red-500 text-white" },
  info: {
    icon: "info",
    ring: "ring-accent/20 dark:ring-accent/40",
    iconColor: "bg-accent text-white dark:text-on-accent",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, kind, title, message }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    toast,
    success: (t, m) => toast("success", t, m),
    error: (t, m) => toast("error", t, m),
    info: (t, m) => toast("info", t, m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => {
          const s = kindStyles[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className={cn(
                "animate-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-white p-3.5 shadow-pop ring-1 backdrop-blur-xl",
                s.ring,
                "dark:bg-card/95"
              )}
            >
              <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", s.iconColor)} aria-hidden="true">
                <Icon name={s.icon} size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-ink">{t.title}</p>
                {t.message && (
                  <p className="mt-0.5 text-[12.5px] leading-snug text-sub">{t.message}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="rounded-lg p-1 text-faint hover:bg-gray-100 dark:hover:bg-white/10"
                aria-label={`Dismiss notification: ${t.title}`}
              >
                <Icon name="close" size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
