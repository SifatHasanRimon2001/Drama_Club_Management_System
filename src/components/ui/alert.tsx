import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";

type AlertTone = "info" | "success" | "warning" | "danger";

const toneStyles: Record<AlertTone, { wrap: string; icon: string; glyph: IconName }> = {
  info: {
    wrap: "border-accent-soft-strong bg-accent-soft text-ink",
    icon: "text-accent-ink",
    glyph: "info",
  },
  success: {
    wrap: "border-green/25 bg-green/10 text-ink",
    icon: "text-green",
    glyph: "check",
  },
  warning: {
    wrap: "border-orange/25 bg-orange/10 text-ink",
    icon: "text-orange",
    glyph: "warn",
  },
  danger: {
    wrap: "border-red/25 bg-red/10 text-ink",
    icon: "text-red",
    glyph: "warn",
  },
};

/**
 * Inline message block.
 *
 * Meaning is carried by an icon and the copy itself, not by colour alone, so it
 * still reads for colour-blind users and in forced-colours mode. Errors and
 * warnings announce themselves (role="alert"); info and success are polite
 * status updates that must not interrupt a screen reader mid-sentence.
 */
export function Alert({
  tone = "info",
  title,
  children,
  action,
  onDismiss,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const style = toneStyles[tone];
  const assertive = tone === "danger" || tone === "warning";

  return (
    <div
      role={assertive ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3.5",
        style.wrap,
        className
      )}
    >
      <Icon
        name={style.glyph}
        size={16}
        className={cn("mt-0.5 shrink-0", style.icon)}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        {title && <p className="text-[13.5px] font-semibold">{title}</p>}
        {children && (
          <div className={cn("text-[13px] leading-relaxed text-sub", title ? "mt-1" : undefined)}>
            {children}
          </div>
        )}
        {action && <div className="mt-3">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            "-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-faint transition",
            "hover:bg-black/5 hover:text-ink dark:hover:bg-white/10",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          )}
        >
          <Icon name="close" size={13} />
        </button>
      )}
    </div>
  );
}
