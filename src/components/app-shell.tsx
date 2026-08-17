"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/client/session";
import { performSignOut } from "@/lib/client/auth-helpers";
import { apiGet, apiPost } from "@/lib/client/api";
import type { NotificationItem } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { Icon, type IconName } from "@/components/icons";
import { ClubLogo } from "@/components/club-logo";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { Container } from "@/components/ui/layout";
import { useRealtimeRefresh, useRealtimeNotification } from "@/lib/client/socket";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  tone?: string;
  perms?: string[];
  anyPerm?: string[];
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "grid", tone: "text-accent dark:text-accent" },
  { href: "/dashboard/members", label: "Members", icon: "members", tone: "text-cyan-600 dark:text-cyan-400", perms: ["member.view"] },
  { href: "/dashboard/departments", label: "Departments", icon: "folder", tone: "text-purple-600 dark:text-purple-400", perms: ["department.view"] },
  { href: "/dashboard/committees", label: "Committees", icon: "trophy", tone: "text-yellow-600 dark:text-yellow-400", perms: ["committee.manage"] },
  { href: "/dashboard/roles", label: "Roles & Access", icon: "shield", tone: "text-indigo-600 dark:text-indigo-400", perms: ["permissions.manage"] },
  { href: "/dashboard/audit", label: "Audit Log", icon: "list", tone: "text-red-600 dark:text-red-400", perms: ["permissions.manage"] },
  {
    href: "/dashboard/registration",
    label: "Registration",
    icon: "megaphone",
    tone: "text-green-600 dark:text-green-400",
    anyPerm: ["registration.manage", "registration.review"],
  },
  {
    href: "/dashboard/promotions",
    label: "Promotions",
    icon: "trend",
    tone: "text-orange-600 dark:text-orange-400",
    anyPerm: ["promotion.submit", "promotion.approve"],
  },
  { href: "/dashboard/events", label: "Events", icon: "calendar", tone: "text-teal-600 dark:text-teal-400", perms: ["events.manage"] },
  { href: "/dashboard/updates", label: "Updates", icon: "note", tone: "text-pink-600 dark:text-pink-400", perms: ["updates.publish"] },
  {
    href: "/dashboard/gallery",
    label: "Gallery",
    icon: "gallery",
    tone: "text-rose-600 dark:text-rose-400",
    anyPerm: ["gallery.upload", "gallery.manage"],
  },
  { href: "/dashboard/notifications", label: "Notifications", icon: "bell", tone: "text-accent dark:text-accent" },
  { href: "/dashboard/contacts", label: "Contact Messages", icon: "mail", tone: "text-emerald-600 dark:text-emerald-400", perms: ["settings.manage"] },
  { href: "/dashboard/settings", label: "Settings", icon: "settings", tone: "text-faint", perms: ["settings.manage"] },
];

const ICONS: Record<NotificationItem["type"], IconName> = {
  PROMOTION: "trend",
  REGISTRATION: "megaphone",
  ANNOUNCEMENT: "megaphone",
  EVENT: "calendar",
  GALLERY: "gallery",
  GENERAL: "bell",
};

const TAB_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "grid", tone: "text-accent dark:text-accent" },
  { href: "/dashboard/members", label: "Members", icon: "members", tone: "text-cyan-600 dark:text-cyan-400", perms: ["member.view"] },
  { href: "/dashboard/events", label: "Events", icon: "calendar", tone: "text-teal-600 dark:text-teal-400", perms: ["events.manage"] },
  { href: "/dashboard/notifications", label: "Activity", icon: "bell", tone: "text-accent dark:text-accent" },
];

const NOTIF_TONES: Record<string, string> = {
  PROMOTION: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  REGISTRATION: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  ANNOUNCEMENT: "bg-accent-soft-strong text-accent-ink",
  EVENT: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
  GALLERY: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
  GENERAL: "bg-gray-100 text-sub dark:bg-white/10",
};

/**
 * Single branding block for the console sidebar.
 *
 * This replaces what used to be two stacked headers — a "Member Console /
 * Drama Club" lockup directly above a "BRAC University Drama Club /
 * Management Console" one — which rendered the logo twice and said
 * essentially the same thing four times. One mark, one name, one label.
 */
function SidebarBrand() {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "mx-3 mt-4 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors",
        "hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      )}
    >
      <ClubLogo size={32} className="shrink-0" />
      <span className="min-w-0 flex-1">
        {/* One line. The sidebar's minimum width is derived from this text's
            measured single-line width, so it fits at every allowed width and
            the ellipsis never actually engages — `truncate` is only here as a
            graceful fallback for a club name longer than this one, with the
            full value still available via the title attribute. */}
        <span
          title="BRAC University Drama Club"
          className="font-display block truncate text-[12.5px] font-bold leading-[1.3] tracking-[-0.02em] text-ink"
        >
          BRAC University Drama Club
        </span>
        <span className="mt-0.5 block truncate text-[9.5px] font-bold uppercase tracking-[0.18em] text-accent-ink">
          Management Console
        </span>
      </span>
    </Link>
  );
}

/* ---------------------------------------------------------------------------
   Resizable sidebar
--------------------------------------------------------------------------- */

const SIDEBAR_STORAGE_KEY = "dcms-sidebar-width";
/**
 * Floor is measured, not guessed: "BRAC University Drama Club" is 168px on one
 * line at 12.5px semibold, plus a 32px logo, a 12px gap, 16px of link padding
 * and 24px of link margins — 252px. Clamping to it means the club name can
 * never be clipped no matter how far the handle is dragged.
 */
const SIDEBAR_MIN = 252;
const SIDEBAR_MAX = 420;
const SIDEBAR_DEFAULT = 272;
/** Arrow-key step when the separator has keyboard focus. */
const SIDEBAR_STEP = 16;

function clampSidebar(px: number): number {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(px)));
}

/**
 * Drag handle sitting on the sidebar's trailing edge.
 *
 * Implemented as an ARIA `separator` with a value, so it is operable without a
 * pointer: arrows nudge, Home/End jump to the limits, Enter/double-click
 * restores the default. Pointer capture keeps the drag alive when the cursor
 * outruns the 12px hit area, and `touch-none` stops a touch drag from scrolling
 * the page instead of resizing.
 */
function SidebarResizer({
  width,
  onResize,
}: {
  width: number;
  onResize: (next: number) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    // The sidebar is pinned to the left edge, so the pointer's x is the width.
    onResize(clampSidebar(e.clientX));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: width - SIDEBAR_STEP,
      ArrowRight: width + SIDEBAR_STEP,
      Home: SIDEBAR_MIN,
      End: SIDEBAR_MAX,
      Enter: SIDEBAR_DEFAULT,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onResize(clampSidebar(next));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onResize(SIDEBAR_DEFAULT)}
      title="Drag to resize · double-click to reset"
      className={cn(
        "group absolute inset-y-0 -right-1.5 z-50 hidden w-3 cursor-col-resize touch-none lg:block",
        "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
      )}
    >
      {/* Hairline that lights up violet on hover/drag — the 12px hit area
          stays invisible so the chrome reads as a 1px divider. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors duration-150",
          dragging ? "bg-accent" : "bg-transparent group-hover:bg-accent"
        )}
      />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, clear: clearSession } = useSession();
  const toast = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Starts at the default so server and client markup agree; the persisted
  // value is applied in a layout effect below, before the browser paints.
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);

  // Restore the persisted width after mount. Deferred by a tick — the same
  // pattern ThemeProvider and SessionProvider use — so the state update lands
  // outside the effect body and SSR markup still matches on hydration.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = Number(localStorage.getItem(SIDEBAR_STORAGE_KEY));
        if (Number.isFinite(stored) && stored > 0) {
          setSidebarWidth(clampSidebar(stored));
        }
      } catch {
        /* storage unavailable (private mode) — keep the default */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const resizeSidebar = useCallback((next: number) => {
    setSidebarWidth(next);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      /* non-fatal: the width just won't persist */
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiGet<{
        notifications: NotificationItem[];
        unreadCount: number;
      }>("/api/notifications?limit=8");
      setNotifications(data.notifications);
      setUnread(data.unreadCount);
    } catch {
      /* ignore */
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadNotifications(), 0);
    return () => clearTimeout(timer);
  }, [loadNotifications]);

  useRealtimeRefresh(["Notification"], loadNotifications, 300);
  useRealtimeNotification((payload) => {
    void loadNotifications();
    if (payload && typeof payload === "object" && !("_bulk" in payload)) {
      const title = typeof payload.title === "string" ? payload.title : "New notification";
      const message = typeof payload.message === "string" ? payload.message : undefined;
      toast.info(title, message);
    }
  });

  const visibleNav = NAV.filter((n) => {
    if (n.perms) return n.perms.some((p) => user?.permissions?.includes(p));
    if (n.anyPerm) return n.anyPerm.some((p) => user?.permissions?.includes(p));
    return true;
  });

  const visibleTabs = TAB_NAV.filter((n) => {
    if (n.perms) return n.perms.some((p) => user?.permissions?.includes(p));
    if (n.anyPerm) return n.anyPerm.some((p) => user?.permissions?.includes(p));
    return true;
  });

  const markRead = async (id: string) => {
    try {
      await apiPost(`/api/notifications/${id}/read`);
      setNotifications((n) =>
        n.map((x) => (x.id === id ? { ...x, readAt: new Date().toISOString() } : x))
      );
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      /* ignore */
    }
  };

  const handleSignOut = useCallback(() => {
    toast.info("Signed out", "See you on stage!");
    void performSignOut(clearSession);
  }, [clearSession, toast]);

  // Brief loading guard
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 dark:bg-card">
        <div className="flex flex-col items-center gap-3">
          <ClubLogo size={32} />
          <p className="text-[13px] font-medium text-sub">Loading…</p>
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <SidebarBrand />
      <nav className="thin-scroll mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {visibleNav.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                active
                  ? "bg-accent-soft font-semibold text-accent-ink"
                  : "text-sub hover:bg-gray-100 hover:text-ink dark:hover:bg-white/8 dark:hover:text-slate-100"
              )}
            >
              <Icon
                name={item.icon}
                size={16}
                className={cn(item.tone, active && "text-accent-ink")}
              />
              {item.label}
              {item.href === "/dashboard/notifications" && unread > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-line border-t px-4 py-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-sub transition hover:bg-gray-100 hover:text-ink dark:hover:bg-white/8 dark:hover:text-slate-100"
        >
          <Icon name="external" size={15} />
          View public site
        </Link>
      </div>
    </div>
  );

  return (
    <div
      className="flex min-h-dvh bg-gray-50 dark:bg-card"
      // One variable drives both the sidebar's width and the content's offset,
      // so the two can never disagree mid-drag.
      style={{ "--sidebar-w": `${sidebarWidth}px` } as React.CSSProperties}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:text-on-accent"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar — user-resizable, width persisted per browser */}
      <aside
        className="border-line bg-card fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] border-r lg:block"
      >
        <div className="relative h-full">{sidebar}</div>
        <SidebarResizer width={sidebarWidth} onResize={resizeSidebar} />
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          <aside
            className="bg-card animate-sheet absolute inset-y-0 left-0 w-[82vw] max-w-72 border-r border-gray-200 shadow-sheet dark:border-white/10"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[var(--sidebar-w)]">
        {/* Top bar */}
        <header className="border-line glass sticky top-0 z-30 border-b">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex size-9 items-center justify-center rounded-lg text-ink transition hover:bg-gray-100 lg:hidden dark:hover:bg-white/10"
              aria-label="Open menu"
            >
              <Icon name="menu" size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-sub">
                {pathname === "/dashboard" ? "Overview" : pageTitle(pathname)}
              </p>
            </div>

            <Dropdown
              width="w-[360px]"
              trigger={(open, toggle) => (
                <button
                  onClick={() => {
                    if (!open) void loadNotifications();
                    toggle();
                  }}
                  className={cn(
                    "relative flex size-9 items-center justify-center rounded-lg transition",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    open
                      ? "bg-gray-100 dark:bg-white/15"
                      : "text-sub hover:bg-gray-100 dark:hover:bg-white/10"
                  )}
                  aria-label="Notifications"
                >
                  <Icon name="bell" size={18} />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              )}
            >
              {(close) => (
                <div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <p className="text-[13.5px] font-semibold text-ink">
                      Notifications
                    </p>
                    <Link
                      href="/dashboard/notifications"
                      onClick={close}
                      className="text-[12px] font-medium text-accent hover:underline "
                    >
                      View all
                    </Link>
                  </div>
                  <div className="border-line max-h-[360px] overflow-y-auto border-t">
                    {notifLoading ? (
                      <p className="px-4 py-6 text-center text-[13px] text-faint">Loading…</p>
                    ) : notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-[13px] text-sub">
                        You&apos;re all caught up.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            void markRead(n.id);
                            if (n.link) {
                              close();
                              router.push(n.link);
                            }
                          }}
                          className={cn(
                            "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-white/5",
                            !n.readAt && "bg-accent-soft/50 "
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                              NOTIF_TONES[n.type] || NOTIF_TONES.GENERAL
                            )}
                          >
                            <Icon name={ICONS[n.type] || "bell"} size={14} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-ink">
                              {n.title}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-sub">
                              {n.message}
                            </span>
                            <span className="mt-1 block text-[11px] text-faint">
                              {timeAgo(n.createdAt)}
                            </span>
                          </span>
                          {!n.readAt && (
                            <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </Dropdown>

            <ThemeToggle />

            <Dropdown
              width="w-56"
              trigger={(open, toggle) => (
                <button
                  onClick={toggle}
                  className={cn(
                    "flex items-center gap-2 rounded-full p-1 pr-2 transition",
                    open ? "bg-gray-100 dark:bg-white/10" : "hover:bg-gray-100 dark:hover:bg-white/8"
                  )}
                  aria-label="Account menu"
                >
                  <Avatar name={user?.name} src={user?.image} size={28} />
                  <span className="hidden max-w-[100px] truncate text-[13px] font-medium text-ink sm:block">
                    {user?.name?.split(" ")[0]}
                  </span>
                  <Icon name="chevron-down" size={12} className="hidden text-faint sm:block" />
                </button>
              )}
            >
              {(close) => (
                <div className="p-1.5">
                  <div className="border-line border-b px-3 py-2.5">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {user?.name}
                    </p>
                    <p className="truncate text-[12px] text-sub">{user?.email}</p>
                  </div>
                  <div className="pt-1.5">
                    {user?.memberId && (
                      <Link
                        href={`/dashboard/members/${user.memberId}`}
                        onClick={close}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink transition hover:bg-gray-100 dark:hover:bg-white/10"
                      >
                        <Icon name="user" size={15} />
                        My Profile
                      </Link>
                    )}
                    <Link
                      href="/dashboard/notifications"
                      onClick={close}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink transition hover:bg-gray-100 dark:hover:bg-white/10"
                    >
                      <Icon name="bell" size={15} />
                      Notifications
                    </Link>
                    <Link
                      href="/"
                      onClick={close}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink transition hover:bg-gray-100 dark:hover:bg-white/10"
                    >
                      <Icon name="external" size={15} />
                      Public site
                    </Link>
                    <button
                      onClick={() => {
                        void handleSignOut();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <Icon name="logout" size={15} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </Dropdown>
          </div>
        </header>

        <Container
          size="page"
          id="main-content"
          className="flex-1 py-8 pb-28 lg:pb-8"
        >
          {children}
        </Container>
      </div>

      {/* iOS-style bottom tab bar (mobile) */}
      <nav
        className="border-line bg-card fixed inset-x-0 bottom-0 z-40 border-t /85 backdrop-blur-2xl lg:hidden /90"
        aria-label="Primary"
      >
        <div className="flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          {visibleTabs.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[10px] font-semibold transition",
                  active ? "text-accent" : "text-faint hover:text-sub"
                )}
              >
              <span className="relative">
                {item.href === "/dashboard/notifications" && unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
                <Icon
                  name={item.icon}
                  size={20}
                  strokeWidth={active ? 2.2 : 1.8}
                  className={cn(item.tone, active && "text-accent")}
                />
              </span>
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[10px] font-medium text-faint transition hover:text-sub"
            aria-label="More"
          >
            <Icon name="menu" size={20} />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}

function pageTitle(pathname: string): string {
  const map: [string, string][] = [
    ["/dashboard/members", "Members"],
    ["/dashboard/departments", "Departments"],
    ["/dashboard/committees", "Committees"],
    ["/dashboard/roles", "Roles & Access"],
    ["/dashboard/audit", "Audit Log"],
    ["/dashboard/registration", "Registration"],
    ["/dashboard/promotions", "Promotions"],
    ["/dashboard/events", "Events"],
    ["/dashboard/updates", "Updates"],
    ["/dashboard/gallery", "Gallery"],
    ["/dashboard/notifications", "Notifications"],
    ["/dashboard/contacts", "Contact Messages"],
    ["/dashboard/settings", "Settings"],
  ];
  for (const [prefix, title] of map) {
    if (pathname.startsWith(prefix)) return title;
  }
  return "Dashboard";
}
