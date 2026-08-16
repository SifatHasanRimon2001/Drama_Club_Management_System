import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Table primitives built on real semantic elements, so screen readers announce
 * rows and columns properly and the browser's own table navigation works.
 *
 * A table is the one component that genuinely cannot reflow to a phone. Rather
 * than collapsing columns into cards (which loses the column relationship), the
 * wrapper scrolls horizontally on its own and is focusable, so the scroll
 * region is reachable by keyboard. The page body never scrolls sideways.
 */
export function TableWrap({
  className,
  caption,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { caption?: string }) {
  return (
    <div
      className={cn("overflow-hidden rounded-2xl border border-line bg-card shadow-card", className)}
      {...props}
    >
      <div
        className="thin-scroll w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        tabIndex={0}
        role="region"
        aria-label={caption ?? "Data table"}
      >
        {children}
      </div>
    </div>
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-left", className)} {...props} />;
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-line bg-elevated/60", className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-line", className)} {...props} />;
}

export function TR({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        "transition-colors duration-150",
        interactive && "cursor-pointer hover:bg-elevated/70",
        className
      )}
      {...props}
    />
  );
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint",
        className
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3.5 text-[13.5px] text-sub", className)} {...props} />;
}

/** Full-width message row for empty results inside a table. */
export function TableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center text-[13.5px] text-faint">
        {children}
      </td>
    </tr>
  );
}
