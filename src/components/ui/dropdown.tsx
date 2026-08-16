"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

export function Dropdown({
  trigger,
  children,
  align = "end",
  width = "w-72",
  className,
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  width?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const toggle = () => setOpen((o) => !o);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      // Return focus to the trigger. Dismissing with Escape otherwise strands
      // keyboard users at the top of the document with no clear position.
      ref.current?.querySelector<HTMLElement>("button, [role='button']")?.focus();
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

  const triggerNode = trigger(open, toggle);
  const labelledTrigger = isValidElement(triggerNode)
    ? cloneElement(triggerNode as ReactElement<Record<string, unknown>>, {
        "aria-expanded": open,
        "aria-haspopup": "menu",
        "aria-controls": open ? menuId : undefined,
      })
    : triggerNode;

  return (
    <div ref={ref} className="relative">
      {labelledTrigger}
      {open && (
        <div
          id={menuId}
          className={cn(
            "animate-sheet absolute top-full z-[60] mt-2 max-w-[calc(100vw-2rem)] origin-top overflow-hidden rounded-xl",
            "glass-strong border border-line-strong shadow-pop",
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
