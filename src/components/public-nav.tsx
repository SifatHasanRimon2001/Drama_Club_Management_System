"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";
import { ClubLogo } from "@/components/club-logo";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { Container } from "@/components/ui/layout";
import { useSession } from "@/lib/client/session";
import { performSignOut } from "@/lib/client/auth-helpers";

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
  const { user, loading, clear } = useSession();
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

  const handleSignOut = useCallback(() => {
    void performSignOut(clear);
  }, [clear]);

  const navLinks = (
    <nav
      className="hidden grid-flow-col auto-cols-max items-center justify-self-center gap-2 xl:grid"
      aria-label="Primary"
    >
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center whitespace-nowrap rounded-lg px-1.5 py-2 text-[12.5px] font-medium transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active
                ? "bg-accent-soft font-semibold text-accent-ink"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-slate-100"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );

  const authArea = (
    <div className="hidden sm:grid shrink-0 grid-flow-col auto-cols-max items-center gap-2">
      {!loading && user ? (
        <Dropdown
          width="w-60"
          trigger={(open, toggle) => (
            <button
              onClick={toggle}
              className={cn(
                "flex items-center gap-2 rounded-full p-1 pr-2 transition-all duration-150",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                open
                  ? "bg-gray-100 dark:bg-white/10"
                  : "hover:bg-gray-100 dark:hover:bg-white/10"
              )}
              aria-label="Account menu"
            >
              <Avatar name={user.name} src={user.image} size={30} />
              <span className="hidden max-w-[110px] truncate text-[13px] font-medium text-ink sm:block dark:text-slate-200">
                {user.name?.split(" ")[0]}
              </span>
              <Icon name="chevron-down" size={12} className="hidden text-faint sm:block" />
            </button>
          )}
        >
          {(close) => (
            <div className="p-1.5">
              <div className="border-b border-gray-100 px-3 py-2.5 dark:border-line">
                <p className="truncate text-[13.5px] font-semibold text-ink dark:text-slate-100">
                  {user.name}
                </p>
                <p className="truncate text-[12px] text-sub dark:text-slate-400">{user.email}</p>
              </div>
              <div className="pt-1.5">
                <Link
                  href="/dashboard"
                  onClick={close}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink transition hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Icon name="grid" size={16} />
                  My Dashboard
                </Link>
                {user.memberId && (
                  <Link
                    href={`/dashboard/members/${user.memberId}`}
                    onClick={close}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink transition hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Icon name="user" size={16} />
                    My Profile
                  </Link>
                )}
                <button
                  onClick={() => {
                    close();
                    handleSignOut();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <Icon name="logout" size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </Dropdown>
      ) : (
        <div className="grid grid-flow-col auto-cols-max items-center gap-2">
          <Link
            href="/login"
            className="hidden h-9 items-center rounded-lg bg-accent px-4 text-[13px] font-semibold text-white dark:text-on-accent transition hover:bg-accent-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="hidden h-9 items-center rounded-lg border border-gray-200 bg-white px-4 text-[13px] font-medium text-ink transition hover:bg-gray-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex xl:hidden 2xl:inline-flex dark:bg-white/5 dark:text-slate-100 dark:border-white/10 dark:hover:bg-white/10"
          >
            <Icon name="grid" size={14} className="mr-1.5" />
            Member Area
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-200",
        scrolled || menuOpen
          ? "glass border-b border-gray-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-line"
          : ""
      )}
    >
      <Container
        size="wide"
        className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-4 2xl:max-w-[1440px]"
      >
        <Link
          href="/"
          className="group grid shrink-0 grid-flow-col auto-cols-max items-center justify-self-start gap-2.5"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
          ) : (
            <ClubLogo
              size={28}
              className="transition-transform duration-200 group-hover:scale-105"
            />
          )}
          <span className="whitespace-nowrap text-left font-display text-[12px] font-bold tracking-tight text-ink dark:text-slate-100 min-[350px]:text-[13px] min-[375px]:text-[14px] 2xl:text-[15px]">
            {clubName || "BRAC University Drama Club"}
          </span>
        </Link>

        {navLinks}

        <div className="grid shrink-0 grid-flow-col auto-cols-max items-center justify-self-end gap-2 sm:gap-3">
          <ThemeToggle />
          {authArea}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-lg text-ink transition hover:bg-gray-100 xl:hidden dark:text-slate-100 dark:hover:bg-white/10"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="public-nav-menu"
          >
            <Icon name={menuOpen ? "close" : "menu"} size={18} />
          </button>
        </div>
      </Container>

      {menuOpen && (
        <div
          id="public-nav-menu"
          className="animate-fade max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-gray-200/80 px-4 pb-4 pt-3 xl:hidden dark:border-line"
        >
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {LINKS.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex items-center whitespace-nowrap rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-150",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    active
                      ? "bg-accent-soft font-semibold text-accent-ink"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-slate-100"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
            <div className="mt-2 flex flex-col gap-2.5 border-t border-gray-200 pt-3 dark:border-line">
              {!loading && user ? (
                <>
                  <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3.5 py-3 dark:bg-white/5">
                    <Avatar name={user.name} src={user.image} size={36} />
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-[14px] font-semibold text-ink dark:text-slate-100">
                        {user.name}
                      </p>
                      <p className="truncate text-[12px] text-sub dark:text-slate-400">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/dashboard"
                    className="flex-1 rounded-lg bg-accent py-2.5 text-center text-[13.5px] font-semibold text-white dark:text-on-accent transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Go to Dashboard
                  </Link>
                  <button
                    onClick={() => handleSignOut()}
                    className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 text-center text-[13.5px] font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:bg-white/5 dark:border-white/10 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex-1 rounded-lg bg-accent py-2.5 text-center text-[13.5px] font-semibold text-white dark:text-on-accent transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 text-center text-[13.5px] font-medium text-ink transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:bg-white/5 dark:text-slate-100 dark:border-white/10 dark:hover:bg-white/10"
                  >
                    Member Area
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
