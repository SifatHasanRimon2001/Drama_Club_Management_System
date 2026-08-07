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
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-7 rounded-lg object-cover" />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-white">
              <Icon name="sparkles" size={15} />
            </span>
          )}
          <span className="truncate text-[15px] font-semibold tracking-tight text-ink dark:text-gray-100">
            {clubName || "Drama Club"}
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 lg:flex">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition-colors",
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

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden items-center rounded-full bg-accent px-4 py-1.5 text-[13.5px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,113,227,0.25)] transition hover:bg-accent-hover active:scale-[0.98] sm:inline-flex"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="hidden items-center rounded-full border border-line bg-white/70 px-4 py-1.5 text-[13.5px] font-medium text-ink transition hover:bg-white active:scale-[0.98] sm:inline-flex dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/20"
          >
            <Icon name="grid" size={14} className="mr-1.5" />
            Member Area
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-full text-ink transition hover:bg-black/[0.05] lg:hidden dark:text-gray-100 dark:hover:bg-white/10"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <Icon name={menuOpen ? "close" : "menu"} size={19} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="animate-fade border-t border-line px-4 pb-4 pt-2 lg:hidden">
          <div className="flex flex-col">
            {LINKS.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-[15px] font-medium",
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
              <Link href="/login" className="flex-1 rounded-full bg-accent py-2 text-center text-sm font-medium text-white">
                Sign In
              </Link>
              <Link
                href="/dashboard"
                className="flex-1 rounded-full border border-line bg-white/60 py-2 text-center text-sm font-medium text-ink dark:bg-white/10 dark:text-gray-100"
              >
                Member Area
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
