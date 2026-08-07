import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared layout system.
 *
 * Every page wraps content in <Container> (single source of truth for
 * page width + gutter padding) and arranges children with <Grid>
 * presets (explicit, tested column counts per breakpoint: phone /
 * tablet / desktop). No page may define its own ad-hoc grid.
 */

const CONTAINER_SIZES = {
  page: "max-w-6xl",
  wide: "max-w-7xl",
  narrow: "max-w-5xl",
  form: "max-w-3xl",
} as const;

export function Container({
  size = "page",
  className,
  children,
}: {
  size?: keyof typeof CONTAINER_SIZES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", CONTAINER_SIZES[size], className)}>
      {children}
    </div>
  );
}

export const GRID = {
  /** Single column (mobile), 2 up on tablet+, 3 up on desktop+. */
  cards: "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3",
  /** Single column, 2 on tablet+, 3 on desktop+, 4 on wide screens. */
  cards4: "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  /** Two equal columns from tablet up (forms, detail rows). */
  split: "grid grid-cols-1 gap-5 sm:grid-cols-2",
  /** Stat tiles: 1 on phone, 2 on tablet, 4 on desktop. */
  stats: "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
  /** Compact item lists (avatar rows, chips). */
  list: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
  /** Media grid (gallery / productions). */
  media: "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  /** Form fields: 1 on phone, 2 on tablet+. */
  fields: "grid grid-cols-1 gap-4 sm:grid-cols-2",
  /** Dashboard overview: 1 on phone, 2 on tablet, 5-column master on desktop (for col-span children). */
  dash: "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5",
  /** Detail layouts: 1 column until desktop, then main + sidebar split (children use col-span). */
  detail: "grid grid-cols-1 gap-6 lg:grid-cols-3",
  /** Compact stat trio: 1 on phone, 3 on tablet+. */
  stats3: "grid grid-cols-1 gap-3 sm:grid-cols-3",
  /** Compact thumbnail strips (media previews): 2 on phone, 3 on tablet, 5 on desktop. */
  thumbs: "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5",
} as const;

export type GridPreset = keyof typeof GRID;

export function Grid({
  preset,
  className,
  children,
}: {
  preset: GridPreset;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(GRID[preset], className)}>{children}</div>;
}

/** Horizontal tool/action row — wraps gracefully on phones. */
export function Toolbar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>;
}

/** Vertical section stack with consistent rhythm. */
export function PageSection({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}
