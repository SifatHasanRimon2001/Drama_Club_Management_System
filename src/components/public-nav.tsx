"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";
import { ClubLogo } from "@/components/club-logo";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { ButtonLink } from "@/components/ui/button";
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSignOut = useCallback(() => {
    void performSignOut(clear);
  }, [clear]);

  const isActive = (href: string): boolean =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Sizing note: text stays at >=12px and controls at >=36px tall even on the
  // narrowest phones. "Member Area" is redundant with the account menu once
  // signed in, so on small screens only "Sign In" shows and the remaining
  // space goes to the hamburger.
  const authButtons = (
    <>
      <ButtonLink href="/login" size="sm">
        Sign In
      </ButtonLink>
      <ButtonLink href="/dashboard" variant="secondary" size="sm" icon="grid" className="hidden sm:inline-flex">
        Member Area
      </ButtonLink>
    </>
  );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-all duration-300",
        // Transparent over the hero, then a frosted panel once the page moves
        // under it — the bar earns its weight only when it overlaps content.
        scrolled
          ? "glass border-line shadow-[0_1px_0_0_var(--color-line),0_8px_32px_-16px_rgba(0,0,0,0.5)]"
          : "border-transparent"
      )}
    >
      <Container
        size="wide"
        className={cn(
          "grid items-center gap-2",
          "grid-cols-[auto_1fr_auto]",
          "h-auto py-2 sm:h-14 sm:py-0",
        )}
      >
        {/* ---- Left: Logo ---- */}
        <Link
          href="/"
          className="group grid min-h-10 shrink-0 grid-flow-col auto-cols-max items-center justify-self-start gap-2 rounded-lg"
        >
          {logoUrl ? (
            // Deliberately a plain <img>: the logo URL is admin-configurable in
            // System Settings and may point at any host, whereas next/image
            // only accepts hosts listed in next.config remotePatterns and would
            // hard-fail the page for anything else.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={clubName || "Club logo"}
              className="size-7 shrink-0 rounded-md object-cover"
            />
          ) : (
            <ClubLogo
              size={22}
              className="transition-transform duration-200 group-hover:scale-105"
            />
          )}
          <span
            className={cn(
              "whitespace-nowrap text-left font-display font-bold tracking-tight",
              "text-[12px] text-ink sm:text-[12.5px] xl:text-[13px]",
              "max-w-[9.5rem] truncate sm:max-w-none"
            )}
          >
            {clubName || "BRAC University Drama Club"}
          </span>
        </Link>

        {/* ---- Center: Desktop Nav Links (lg+) ---- */}
        <nav
          className={cn(
            "col-start-2 row-start-1",
            "hidden w-full justify-center gap-0.5 text-[12.5px]",
            "lg:flex lg:text-[13px]"
          )}
          aria-label="Primary"
        >
          {LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative whitespace-nowrap rounded-lg px-3 py-2 font-medium transition-colors duration-200",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  active ? "text-ink" : "text-faint hover:text-ink"
                )}
              >
                {l.label}
                {/* Violet underline marks the current section. Rendered always
                    and toggled by opacity/scale so it animates rather than
                    popping between routes. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-[var(--grad-1)] to-[var(--grad-2)]",
                    "origin-center transition-all duration-300",
                    active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {/* ---- Right: Theme + Auth + Mobile Hamburger ---- */}
        <div className="col-start-3 row-start-1 flex items-center justify-self-end gap-1">
          <ThemeToggle />
          {!loading && user ? (
            <Dropdown
              width="w-56 sm:w-60"
              trigger={(open, toggle) => (
                <button
                  onClick={toggle}
                  className={cn(
                    "flex min-h-10 items-center gap-1.5 rounded-full p-1 pr-2 transition-all duration-150",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    open ? "bg-elevated" : "hover:bg-elevated"
                  )}
                  aria-label="Account menu"
                >
                  <Avatar name={user.name} src={user.image} size={28} />
                  <span className="hidden max-w-[90px] truncate text-[12.5px] font-medium text-ink sm:block">
                    {user.name?.split(" ")[0]}
                  </span>
                  <Icon name="chevron-down" size={11} className="hidden sm:block" />
                </button>
              )}
            >
              {(close) => (
                <div className="p-1.5">
                  <div className="border-b border-line px-3 py-2.5">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {user.name}
                    </p>
                    <p className="truncate text-[12px] text-sub">{user.email}</p>
                  </div>
                  <div className="pt-1.5">
                    {user.memberId && (
                      <Link
                        href={`/dashboard/members/${user.memberId}`}
                        onClick={close}
                        className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-ink transition hover:bg-accent-soft hover:text-accent-ink"
                      >
                        <Icon name="user" size={15} />
                        My Profile
                      </Link>
                    )}
                    <Link
                      href="/dashboard"
                      onClick={close}
                      className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-ink transition hover:bg-accent-soft hover:text-accent-ink"
                    >
                      <Icon name="grid" size={15} />
                      Member Area
                    </Link>
                    <button
                      onClick={() => {
                        close();
                        handleSignOut();
                      }}
                      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-red transition hover:bg-red/10"
                    >
                      <Icon name="logout" size={15} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </Dropdown>
          ) : !loading ? (
            authButtons
          ) : null}

          {/* Mobile hamburger — shown below lg, opens dropdown with nav links */}
          <Dropdown
            align="end"
            width="w-52 sm:w-56"
            trigger={(open, toggle) => (
              <button
                type="button"
                onClick={toggle}
                className={cn(
                  "lg:hidden",
                  // 40px square: comfortably tappable without crowding the bar.
                  "flex size-10 items-center justify-center rounded-xl border border-transparent text-ink transition hover:border-line hover:bg-elevated",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                )}
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                aria-controls={open ? "public-nav-menu" : undefined}
              >
                <Icon name={open ? "close" : "menu"} size={18} />
              </button>
            )}
          >
            {(close) => (
              <nav
                id="public-nav-menu"
                className="flex flex-col gap-1 p-2"
                aria-label="Mobile"
              >
                {LINKS.map((l) => {
                  const active = isActive(l.href);
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      onClick={close}
                      className={cn(
                        // min-h-11 (44px) keeps every menu row a comfortable
                        // touch target on phones.
                        "flex min-h-11 items-center rounded-lg px-3 text-[13.5px] font-medium transition-colors duration-150",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        active
                          ? "bg-accent-soft font-semibold text-accent-ink"
                          : "text-sub hover:bg-elevated hover:text-ink"
                      )}
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </Dropdown>
        </div>
      </Container>
    </header>
  );
}
