"use client";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";

export function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const pages: (number | "…")[] = [];
  const add = (p: number | "…") => pages.push(p);
  const set = new Set<number>();
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) set.add(p);
  }
  let prev = 0;
  for (const p of [...set].sort((a, b) => a - b)) {
    if (p - prev > 1) add("…");
    add(p);
    prev = p;
  }

  return (
    <div className={cn("flex items-center justify-center gap-1", className)}>
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="flex size-9 items-center justify-center rounded-lg text-sub transition hover:bg-elevated hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
        aria-label="Previous page"
      >
        <Icon name="chevron-left" size={16} />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-faint">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "tabular flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-[13px] font-medium transition",
              p === page
                ? "bg-accent font-semibold text-on-accent shadow-[0_2px_10px_var(--color-accent-soft-strong)]"
                : "text-sub hover:bg-elevated hover:text-ink"
            )}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="flex size-9 items-center justify-center rounded-lg text-sub transition hover:bg-elevated hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
        aria-label="Next page"
      >
        <Icon name="chevron-right" size={16} />
      </button>
    </div>
  );
}
