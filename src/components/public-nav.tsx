"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/committee", label: "Committee" },
  { href: "/departments", label: "Departments" },
  { href: "/productions", label: "Productions" },
  { href: "/events", label: "Events" },
  { href: "/updates", label: "Updates" },
  { href: "/gallery", label: "Gallery" },
  { href: "/recruitment", label: "Recruitment" },
  { href: "/contact", label: "Contact" },
];

export function PublicNav({
  clubName,
  logoUrl,
}: {
  clubName: string;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMenuOpen(false), 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled || menuOpen ? "glass border-b border-line shadow-[0_1px_0_rgba(0,0,0,0.04)]" : ""
      )}
    >
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 shrink items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-7 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
              <Icon name="sparkles" size={15} />
            </span>
          )}
          <span className="max-w-[38vw] truncate text-[15px] font-semibold tracking-tight text-ink dark:text-gray-100 sm:max-w-[30vw]">
            {clubName || "Drama Club"}
          </span>
        </Link>

        <div className="hidden items-center xl:flex">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-2 text-[13.5px] font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  active
                    ? "bg-black/[0.06] text-ink dark:bg-white/15 dark:text-white"
                    : "text-sub hover:bg-black/[0.04] hover:text-ink dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden h-9 items-center rounded-full bg-accent px-4 text-[13.5px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,113,227,0.25)] transition hover:bg-accent-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="hidden h-9 items-center rounded-full border border-line bg-white/70 px-4 text-[13.5px] font-medium text-ink transition hover:bg-black/[0.03] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/20"
          >
            <Icon name="grid" size={14} className="mr-1.5" />
            Member Area
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-10 items-center justify-center rounded-full text-ink transition hover:bg-black/[0.05] xl:hidden dark:text-gray-100 dark:hover:bg-white/10"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="public-nav-menu"
          >
            <Icon name={menuOpen ? "close" : "menu"} size={19} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          id="public-nav-menu"
          className="animate-fade max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-line px-4 pb-4 pt-2 xl:hidden"
        >
          <nav className="flex flex-col" aria-label="Mobile">
            {LINKS.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-xl px-3 py-3 text-[15px] font-medium",
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-ink hover:bg-black/[0.04] dark:text-gray-100 dark:hover:bg-white/10"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
            <div className="mt-2 flex gap-2 border-t border-line pt-3 dark:border-white/10">
              <Link
                href="/login"
                className="flex-1 rounded-full bg-accent py-2.5 text-center text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Sign In
              </Link>
              <Link
                href="/dashboard"
                className="flex-1 rounded-full border border-line bg-white/60 py-2.5 text-center text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:bg-white/10 dark:text-gray-100"
              >
                Member Area
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
