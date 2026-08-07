"use client";

import { useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";

interface ThemeToggleProps {
  className?: string;
  asSegmented?: boolean;
}

const ORDER: Theme[] = ["light", "dark", "system"];

export function ThemeToggle({ className, asSegmented }: ThemeToggleProps) {
  const { theme, resolved, setTheme } = useTheme();

  if (asSegmented) {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-full bg-black/[0.06] p-1 dark:bg-white/10",
          className
        )}
        role="group"
        aria-label="Appearance"
      >
        {ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            aria-pressed={theme === t}
            className={cn(
              "rounded-full px-3 py-1 text-[12.5px] font-medium capitalize transition-all",
              theme === t
                ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#3a3a3c] dark:text-white"
                : "text-sub hover:text-ink dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            {t}
          </button>
        ))}
      </div>
    );
  }

  const next = (): Theme => {
    // Quick toggle: flip between light and dark (like iOS appearance toggle).
    // "System" is available via the segmented control (e.g. Settings).
    return resolved === "dark" ? "light" : "dark";
  };

  return (
    <button
      type="button"
      onClick={() => setTheme(next())}
      className={cn(
        "flex size-10 items-center justify-center rounded-full text-sub transition hover:bg-black/[0.05] hover:text-ink active:scale-95",
        "dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className
      )}
      aria-label={`Appearance: ${theme}. Click to switch theme.`}
      title={`Appearance: ${theme}`}
    >
      <Icon name={theme === "dark" ? "moon" : "sun"} size={18} />
    </button>
  );
}