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
      {/* Visibility is controlled by this wrapper, not by a `hidden` class on
          the button itself: `cn()` concatenates without resolving Tailwind
          conflicts, so a `hidden` passed via className loses to the
          `inline-flex` baked into the button base and the button stayed
          visible at 320px, pushing the whole cluster off-screen.
          `sm:contents` makes the wrapper disappear from the box tree when
          shown, so it does not disturb the flex layout. */}
      <span className="hidden sm:contents">
        <ButtonLink href="/dashboard" variant="secondary" size="sm" icon="grid">
          Member Area
        </ButtonLink>
      </span>
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
        size="shell"
        className={cn(
          "grid items-center gap-2",
          // Every flexible column is minmax(0,…) — NOT `auto` or a bare `1fr`.
          // A bare `1fr` is `minmax(auto, 1fr)`, and `auto` refuses to shrink
          // below its content's min-content width. That floor is what pushed
          // the right-hand cluster (theme toggle, Sign In, menu) off-screen:
          // the nav's ten nowrap links at 1024–1235px, and the truncated club
          // name at ~320px. Because the header is `fixed`, neither produced a
          // scrollbar — the controls were simply unreachable.
          //
          // Columns 1 and 2 may now collapse; only column 3 holds its size,
          // because those are the controls that must never disappear.
          "grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto]",
          "h-auto py-2 sm:h-14 sm:py-0",
        )}
      >
        {/* ---- Left: Logo ---- */}
        <Link
          href="/"
          className="group flex min-h-10 min-w-0 items-center justify-self-start gap-2 rounded-lg"
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
          {/* min-w-0 lets this shrink inside the grid column; `truncate` then
              trims the club name to whatever room is left rather than forcing
              the row wider than the viewport. No fixed max-width, so it uses
              all available space on large screens and yields it on small. */}
          <span
            className={cn(
              "font-display min-w-0 truncate text-left font-bold tracking-tight",
              "text-[12px] text-ink sm:text-[12.5px] xl:text-[13px]"
            )}
          >
            {clubName || "BRAC University Drama Club"}
          </span>
        </Link>

        {/* ---- Center: Desktop Nav Links ----
            Ten links need ~765px; with the brand and the right-hand cluster
            that is ~1310px of hard minimum, so `lg` (1024px) and even `xl`
            (1280px) both overlap. The custom breakpoint is the first width
            where the full row genuinely fits; below it the hamburger takes over.

            `min-w-0` + horizontal scroll is the safety net: the club name comes
            from admin settings and can be any length, so the column width is
            not knowable at build time. If it ever squeezes this column, the
            links scroll within it instead of painting over the logo and the
            sign-in buttons. */}
        <nav
          className={cn(
            "col-start-2 row-start-1",
            "no-scrollbar hidden w-full min-w-0 justify-center gap-0.5 overflow-x-auto text-[12.5px]",
            "min-[1320px]:flex min-[1320px]:text-[13px]"
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
                  "relative whitespace-nowrap rounded-lg px-2.5 py-2 font-medium transition-colors duration-200 2xl:px-3",
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
                  // Mirrors the nav's breakpoint exactly — one of the two is
                  // always visible, and never both.
                  "min-[1320px]:hidden",
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
