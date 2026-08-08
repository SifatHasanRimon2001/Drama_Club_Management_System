import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";

/**
 * TicketStub — a clean date chip (accent-trimmed, neutral surface).
 * Used on event cards.
 */
export function TicketStub({
  date,
  size = "md",
  className,
}: {
  date: Date;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "w-14 px-1 py-1.5",
    md: "w-[70px] px-1.5 py-2.5",
    lg: "w-24 px-1.5 py-3",
  } as const;
  const day = {
    sm: "text-[18px]",
    md: "text-[22px]",
    lg: "text-[28px]",
  } as const;
  const month = {
    sm: "text-[10px]",
    md: "text-[11px]",
    lg: "text-[12px]",
  } as const;

  return (
    <div
      className={cn(
        "ticket-stub flex shrink-0 flex-col items-center justify-center text-center text-accent",
        sizes[size],
        className
      )}
    >
      <Icon name="ticket" size={size === "sm" ? 11 : 13} className="mb-0.5" />
      <span className={cn("font-display font-bold leading-none", day[size])}>
        {date.getDate()}
      </span>
      <span
        className={cn(
          "mt-1 font-semibold uppercase tracking-wide",
          month[size]
        )}
      >
        {date.toLocaleString(undefined, { month: "short" })}
      </span>
      {size === "lg" && (
        <span className="text-[10.5px] font-medium text-faint">
          {date.getFullYear()}
        </span>
      )}
    </div>
  );
}
