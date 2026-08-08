"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/client/session";
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
  perms?: string[];
  anyPerm?: string[];
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "grid" },
  { href: "/dashboard/members", label: "Members", icon: "members", perms: ["member.view"] },
  { href: "/dashboard/departments", label: "Departments", icon: "folder", perms: ["department.view"] },
  { href: "/dashboard/committees", label: "Committees", icon: "trophy", perms: ["committee.manage"] },
  { href: "/dashboard/roles", label: "Roles & Access", icon: "shield", perms: ["permissions.manage"] },
  { href: "/dashboard/audit", label: "Audit Log", icon: "list", perms: ["permissions.manage"] },
  {
    href: "/dashboard/registration",
    label: "Registration",
    icon: "megaphone",
    anyPerm: ["registration.manage", "registration.review"],
  },
  {
    href: "/dashboard/promotions",
    label: "Promotions",
    icon: "trend",
    anyPerm: ["promotion.submit", "promotion.approve"],
  },
  { href: "/dashboard/events", label: "Events", icon: "calendar", perms: ["events.manage"] },
  { href: "/dashboard/updates", label: "Updates", icon: "note", perms: ["updates.publish"] },
  {
    href: "/dashboard/gallery",
    label: "Gallery",
    icon: "gallery",
    anyPerm: ["gallery.upload", "gallery.manage"],
  },
  { href: "/dashboard/notifications", label: "Notifications", icon: "bell" },
  { href: "/dashboard/contacts", label: "Contact Messages", icon: "mail", perms: ["settings.manage"] },
  { href: "/dashboard/settings", label: "Settings", icon: "settings", perms: ["settings.manage"] },
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
  { href: "/dashboard", label: "Overview", icon: "grid" },
  { href: "/dashboard/members", label: "Members", icon: "members", perms: ["member.view"] },
  { href: "/dashboard/events", label: "Events", icon: "calendar", perms: ["events.manage"] },
  { href: "/dashboard/notifications", label: "Activity", icon: "bell" },
];

const NOTIF_TONES: Record<string, string> = {
  PROMOTION: "bg-purple/10 text-purple",
  REGISTRATION: "bg-orange/10 text-orange",
  ANNOUNCEMENT: "bg-blue/10 text-blue",
  EVENT: "bg-teal/10 text-teal",
  GALLERY: "bg-pink/10 text-pink",
  GENERAL: "bg-gray-500/10 text-sub",
};

function StageLights() {
  return (
    <div className="flex items-center gap-2.5 px-5 pt-5">
      <ClubLogo size={30} />
      <div className="min-w-0 leading-tight">
        <p className="truncate font-display text-[13.5px] font-bold tracking-tight text-ink dark:text-slate-100">
          Member Console
        </p>
        <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-accent">
          Drama Club
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clear: clearSession } = useSession();
  const toast = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);

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

  // Live: keep the bell badge fresh and pop a toast for brand-new
  // notifications (pushed to this user's socket room only).
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

  /**
   * Logout is a full authentication reset, not just a redirect:
   *  1. Clear the client-side session state immediately so no component can
   *     observe a stale "logged in" user while the request is in flight.
   *  2. Invalidate the NextAuth session cookie server-side. Using
   *     `redirect: false` lets us catch failures (e.g. the session was already
   *     expired) without aborting the flow.
   *  3. Hard-navigate to /login. A full page load discards all in-memory auth
   *     state (React context, socket room membership) and guarantees the
   *     browser back/forward cache can't resurrect the dashboard shell.
   */
  const handleSignOut = useCallback(async () => {
    clearSession();
    toast.info("Signed out", "See you on stage!");
    try {
      await signOut({ redirect: false, callbackUrl: "/login" });
    } catch {
      // The sign-out request failed (network/server issue) or the session was
      // already expired — the httpOnly cookie cannot be cleared client-side.
      // Flag this page load so the login page doesn't bounce the user straight
      // back into the dashboard as if logout never happened.
      try {
        window.sessionStorage.setItem("dcms:signed-out", "1");
      } catch {
        /* storage unavailable — ignore */
      }
    }
    window.location.assign("/login");
  }, [clearSession, toast]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <StageLights />
      <div className="flex items-center gap-2.5 px-5 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <ClubLogo size={30} />
          <div className="flex min-w-0 flex-col justify-center leading-tight">
            <p className="font-display text-left text-[14px] font-bold leading-snug tracking-tight text-ink dark:text-slate-100">
              BRAC University Drama Club
            </p>
            <p className="text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-gold">
              Management Console
            </p>
          </div>
        </Link>
      </div>
      <nav className="thin-scroll flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
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
                "relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-all",
                active
                  ? "bg-gradient-to-r from-accent-soft-strong via-accent-soft to-transparent font-semibold text-accent shadow-[inset_0_0_0_1px_rgba(212,175,55,0.28)]"
                  : "text-sub hover:bg-black/[0.05] hover:text-ink dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
              )}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gradient-to-b from-gold-light to-[#1e40af]"
                />
              )}
              <Icon name={item.icon} size={17} className={active ? "text-gold" : ""} />
              {item.label}
              {item.href === "/dashboard/notifications" && unread > 0 && (
                <span className="ml-auto rounded-full bg-red px-1.5 py-0.5 text-[10.5px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line px-4 py-4 dark:border-white/10">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium text-sub transition hover:bg-black/[0.05] hover:text-ink dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
        >
          <Icon name="external" size={16} />
          View public site
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-canvas dark:bg-black">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-full focus:bg-gradient-to-br focus:from-gold-light focus:via-gold focus:to-[#1e40af] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-line bg-white/85 backdrop-blur-2xl lg:block dark:border-white/10 dark:bg-[#0b1220]/85">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-plum/[0.06] via-transparent to-transparent dark:from-[#1e3a8a]/25 dark:via-transparent"
        />
        <div className="relative h-full">{sidebar}</div>
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          <aside
            className="animate-sheet absolute inset-y-0 left-0 w-[82vw] max-w-72 border-r border-white/10 bg-white/95 shadow-pop backdrop-blur-2xl dark:bg-[#0b1220]/95"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Top bar */}
        <header className="glass sticky top-0 z-30 border-b border-line">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex size-10 items-center justify-center rounded-full text-ink transition hover:bg-black/[0.05] lg:hidden dark:text-slate-100 dark:hover:bg-white/10"
              aria-label="Open menu"
            >
              <Icon name="menu" size={19} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-sub dark:text-slate-400">
                {pathname === "/dashboard" ? "Overview" : pageTitle(pathname)}
              </p>
            </div>

            <Dropdown
              width="w-[380px]"
              trigger={(open, toggle) => (
                <button
                  onClick={() => {
                    if (!open) void loadNotifications();
                    toggle();
                  }}
                  className={cn(
                    "relative flex size-10 items-center justify-center rounded-full transition",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    open
                      ? "bg-black/[0.07] dark:bg-white/15"
                      : "text-sub hover:bg-black/[0.05] dark:text-slate-400 dark:hover:bg-white/10"
                  )}
                  aria-label="Notifications"
                >
                  <Icon name="bell" size={19} />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-red text-[9.5px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              )}
            >
              {(close) => (
                <div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <p className="text-[14px] font-semibold text-ink dark:text-slate-100">
                      Notifications
                    </p>
                    <Link
                      href="/dashboard/notifications"
                      onClick={close}
                      className="text-[12.5px] font-medium text-accent hover:underline"
                    >
                      View all
                    </Link>
                  </div>
                  <div className="max-h-[380px] overflow-y-auto border-t border-line dark:border-white/10">
                    {notifLoading ? (
                      <p className="px-4 py-6 text-center text-[13px] text-faint">Loading…</p>
                    ) : notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-[13px] text-sub dark:text-slate-400">
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
                            "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/5",
                            !n.readAt && "bg-accent-soft/40 dark:bg-white/5"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                              NOTIF_TONES[n.type] || NOTIF_TONES.GENERAL
                            )}
                          >
                            <Icon name={ICONS[n.type] || "bell"} size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold text-ink dark:text-slate-100">
                              {n.title}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-sub dark:text-slate-400">
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
                    open ? "bg-black/[0.06] dark:bg-white/10" : "hover:bg-black/[0.04] dark:hover:bg-white/5"
                  )}
                  aria-label="Account menu"
                >
                  <Avatar name={user?.name} src={user?.image} size={30} />
                  <span className="hidden max-w-[110px] truncate text-[13px] font-medium text-ink sm:block dark:text-slate-200">
                    {user?.name?.split(" ")[0]}
                  </span>
                  <Icon name="chevron-down" size={13} className="hidden text-faint sm:block" />
                </button>
              )}
            >
              {(close) => (
                <div className="p-1.5">
                  <div className="border-b border-line px-3 py-2.5 dark:border-white/10">
                    <p className="truncate text-[13.5px] font-semibold text-ink dark:text-slate-100">
                      {user?.name}
                    </p>
                    <p className="truncate text-[12px] text-sub dark:text-slate-400">{user?.email}</p>
                  </div>
                  <div className="pt-1.5">
                    {user?.memberId && (
                      <Link
                        href={`/dashboard/members/${user.memberId}`}
                        onClick={close}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium text-ink transition hover:bg-black/[0.05] dark:text-slate-200 dark:hover:bg-white/10"
                      >
                        <Icon name="user" size={16} />
                        My Profile
                      </Link>
                    )}
                    <Link
                      href="/dashboard/notifications"
                      onClick={close}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium text-ink transition hover:bg-black/[0.05] dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Icon name="bell" size={16} />
                      Notifications
                    </Link>
                    <Link
                      href="/"
                      onClick={close}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium text-ink transition hover:bg-black/[0.05] dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Icon name="external" size={16} />
                      Public site
                    </Link>
                    <button
                      onClick={() => {
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/85 backdrop-blur-2xl lg:hidden dark:border-white/10 dark:bg-[#0b1220]/90"
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
                  active ? "text-accent" : "text-faint hover:text-sub dark:text-slate-400"
                )}
              >
                {item.href === "/dashboard/notifications" && unread > 0 && (
                  <span className="absolute right-[calc(50%-18px)] top-1.5 flex size-4 items-center justify-center rounded-full bg-red text-[9px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
                <Icon name={item.icon} size={21} strokeWidth={active ? 2.4 : 2} />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[10px] font-medium text-faint transition hover:text-sub dark:text-slate-400"
            aria-label="More"
          >
            <Icon name="menu" size={21} />
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
