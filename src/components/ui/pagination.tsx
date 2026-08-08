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
    <div className={cn("flex items-center justify-center gap-1.5", className)}>
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="flex size-8 items-center justify-center rounded-full text-sub transition hover:bg-black/[0.05] disabled:opacity-40 dark:hover:bg-white/10"
        aria-label="Previous page"
      >
        <Icon name="chevron-left" size={16} />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-sub">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[13px] font-medium transition",
              p === page
                ? "bg-gradient-to-br from-gold-light via-gold to-[#1e40af] font-bold text-white shadow-gold"
                : "text-sub hover:bg-black/[0.05] dark:hover:bg-white/10"
            )}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="flex size-8 items-center justify-center rounded-full text-sub transition hover:bg-black/[0.05] disabled:opacity-40 dark:hover:bg-white/10"
        aria-label="Next page"
      >
        <Icon name="chevron-right" size={16} />
      </button>
    </div>
  );
}
