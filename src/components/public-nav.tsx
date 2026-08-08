"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";
import { ClubLogo } from "@/components/club-logo";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { Container } from "@/components/ui/layout";
import { apiGet } from "@/lib/client/api";
import type { SessionUser } from "@/lib/types";

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

// Broadcast key written by the dashboard SessionProvider on logout, so the
// public nav (which lives outside that provider) can react to sign-outs that
// happen in another tab.
const AUTH_BROADCAST_KEY = "dcms:auth-state";

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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const data = await apiGet<{ user: SessionUser | null }>("/api/session");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setSessionChecked(true);
    }
  }, []);

  // Load the session once; re-check when the tab becomes active or another
  // tab logs out (the httpOnly cookie can only be read server-side).
  useEffect(() => {
    const timer = setTimeout(() => void loadSession(), 0);
    const onFocus = () => void loadSession();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadSession();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_BROADCAST_KEY) void loadSession();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, [loadSession]);

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

  // Full reset on sign-out (same contract as the dashboard shell): clear the
  // client state, invalidate the cookie server-side, then hard-navigate.
  const handleSignOut = useCallback(async () => {
    setUser(null);
    try {
      await signOut({ redirect: false, callbackUrl: "/login" });
    } catch {
      // Cookie could not be cleared server-side — flag the page load so the
      // login page doesn't bounce the user straight back into the dashboard.
      try {
        window.sessionStorage.setItem("dcms:signed-out", "1");
      } catch {
        /* ignore */
      }
    }
    window.location.assign("/login");
  }, []);

  const navLinks = (
    <>
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group/link relative inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-2 text-[13.5px] font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active
                ? "text-accent"
                : "text-sub hover:text-ink dark:text-slate-400 dark:hover:text-slate-100"
            )}
          >
            {l.label}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-3 -bottom-0.5 h-px origin-left bg-gradient-to-r from-accent to-transparent transition-transform duration-300",
                active ? "scale-x-100" : "scale-x-0 group-hover/link:scale-x-100"
              )}
            />
          </Link>
        );
      })}
    </>
  );

  const authArea = (
    <>
      {sessionChecked && user ? (
        <Dropdown
          width="w-60"
          trigger={(open, toggle) => (
            <button
              onClick={toggle}
              className={cn(
                "flex items-center gap-2 rounded-full p-1 pr-2 transition",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                open
                  ? "bg-black/[0.06] dark:bg-white/10"
                  : "hover:bg-black/[0.05] dark:hover:bg-white/10"
              )}
              aria-label="Account menu"
            >
              <Avatar name={user.name} src={user.image} size={30} />
              <span className="hidden max-w-[110px] truncate text-[13px] font-medium text-ink sm:block dark:text-slate-200">
                {user.name?.split(" ")[0]}
              </span>
              <Icon name="chevron-down" size={13} className="hidden text-faint sm:block" />
            </button>
          )}
        >
          {(close) => (
            <div className="p-1.5">
              <div className="border-b border-line px-3 py-2.5 dark:border-white/10">
                <p className="truncate text-[13.5px] font-semibold text-ink dark:text-slate-100">
                  {user.name}
                </p>
                <p className="truncate text-[12px] text-sub dark:text-slate-400">{user.email}</p>
              </div>
              <div className="pt-1.5">
                <Link
                  href="/dashboard"
                  onClick={close}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium text-ink transition hover:bg-black/[0.05] dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Icon name="grid" size={16} />
                  My Dashboard
                </Link>
                {user.memberId && (
                  <Link
                    href={`/dashboard/members/${user.memberId}`}
                    onClick={close}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium text-ink transition hover:bg-black/[0.05] dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Icon name="user" size={16} />
                    My Profile
                  </Link>
                )}
                <button
                  onClick={() => {
                    close();
                    void handleSignOut();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium text-red transition hover:bg-red/10"
                >
                  <Icon name="logout" size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </Dropdown>
      ) : (
        <>
          <Link
            href="/login"
            className="hidden h-9 items-center rounded-full bg-gradient-to-br from-gold-light via-gold to-[#1e40af] px-4 text-[13.5px] font-bold text-white shadow-gold transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="hidden h-9 items-center rounded-full border border-line bg-white/70 px-4 text-[13.5px] font-medium text-ink transition hover:bg-black/[0.03] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20"
          >
            <Icon name="grid" size={14} className="mr-1.5" />
            Member Area
          </Link>
        </>
      )}
    </>
  );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled || menuOpen
          ? "glass border-b border-line shadow-[0_1px_0_rgba(0,0,0,0.04)]"
          : ""
      )}
    >
      <Container size="wide" className="flex h-14 items-center justify-between gap-3">
        <Link href="/" className="group flex min-w-0 shrink items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
          ) : (
            <ClubLogo
              size={30}
              className="transition-transform duration-300 group-hover:scale-105"
            />
          )}
          <span className="min-w-0 max-w-[46vw] text-left font-display text-[15.5px] font-bold leading-tight tracking-tight text-ink dark:text-slate-100 sm:max-w-[38vw] xl:max-w-[220px]">
            {clubName || "BRAC University Drama Club"}
          </span>
        </Link>

        <div className="hidden items-center xl:flex">{navLinks}</div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <div className="hidden sm:block">{authArea}</div>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-10 items-center justify-center rounded-full text-ink transition hover:bg-black/[0.05] xl:hidden dark:text-slate-100 dark:hover:bg-white/10"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="public-nav-menu"
          >
            <Icon name={menuOpen ? "close" : "menu"} size={19} />
          </button>
        </div>
      </Container>

      {menuOpen && (
        <div
          id="public-nav-menu"
          className="animate-fade max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-line px-4 pb-4 pt-2 xl:hidden"
        >
          <nav className="flex flex-col" aria-label="Mobile">
            {navLinks}
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3 dark:border-white/10">
              {sessionChecked && user ? (
                <>
                  <div className="flex items-center gap-3 rounded-xl bg-black/[0.04] px-3.5 py-3 dark:bg-white/10">
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
                    className="flex-1 rounded-full bg-gradient-to-br from-gold-light via-gold to-[#1e40af] py-2.5 text-center text-sm font-bold text-white shadow-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Go to Dashboard
                  </Link>
                  <button
                    onClick={() => void handleSignOut()}
                    className="flex-1 rounded-full border border-line bg-white/60 py-2.5 text-center text-sm font-medium text-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:bg-white/10"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex-1 rounded-full bg-gradient-to-br from-gold-light via-gold to-[#1e40af] py-2.5 text-center text-sm font-bold text-white shadow-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex-1 rounded-full border border-line bg-white/60 py-2.5 text-center text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:bg-white/10 dark:text-slate-100"
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
