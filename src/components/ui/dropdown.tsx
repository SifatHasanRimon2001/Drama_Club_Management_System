"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Dropdown({
  trigger,
  children,
  align = "end",
  width = "w-72",
  className,
}: {
  trigger: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  width?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger(open)}
      {open && (
        <div
          className={cn(
            "animate-sheet absolute top-full z-[60] mt-2 origin-top overflow-hidden rounded-2xl border border-line bg-white/95 shadow-pop backdrop-blur-2xl",
            "dark:bg-[#2c2c2e]/95 dark:border-white/10",
            align === "end" ? "right-0" : "left-0",
            width,
            className
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
