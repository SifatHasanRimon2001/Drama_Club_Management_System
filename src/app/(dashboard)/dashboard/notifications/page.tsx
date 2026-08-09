"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/client/api";
import type { NotificationItem, Pagination } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination as Pager } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";
import { useRealtimeRefresh } from "@/lib/client/socket";

const ICONS: Record<string, IconName> = {
  PROMOTION: "trend",
  REGISTRATION: "megaphone",
  ANNOUNCEMENT: "megaphone",
  EVENT: "calendar",
  GALLERY: "gallery",
  GENERAL: "bell",
};

const TONES: Record<string, string> = {
  PROMOTION: "bg-purple/12 text-purple dark:bg-purple/20 dark:text-purple-300",
  REGISTRATION: "bg-orange/12 text-orange dark:bg-orange/20 dark:text-orange-300",
  ANNOUNCEMENT: "bg-blue/12 text-blue dark:bg-blue/20 ",
  EVENT: "bg-teal/12 text-teal dark:bg-teal/20 dark:text-teal-300",
  GALLERY: "bg-pink/12 text-pink dark:bg-pink/20 dark:text-pink-300",
  GENERAL: "bg-gray-500/10 text-sub dark:text-slate-400",
};

export default function NotificationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<NotificationItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams();
      if (page > 1) params.set("page", String(page));
      const data = await apiGet<{
        notifications: NotificationItem[];
        unreadCount: number;
        pagination: Pagination;
      }>(`/api/notifications?${params.toString()}`);
      setRows(data.notifications);
      setUnread(data.unreadCount);
      setPagination(data.pagination);
    } catch (e) {
      setRows([]);
      setLoadError(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Live: new notifications appear without refreshing the page.
  useRealtimeRefresh(["Notification"], load, 300);

  const open = async (n: NotificationItem) => {
    if (!n.readAt) {
      try {
        await apiPost(`/api/notifications/${n.id}/read`);
        void load();
      } catch {
        /* ignore */
      }
    }
    if (n.link) router.push(n.link);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="bell"
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "You're all caught up"}
      />

      {loadError ? (
        <EmptyState
          icon="warn"
          title="Couldn't load notifications"
          message={loadError}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : loading && !rows.length ? (
        <PageLoader label="Loading notifications…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No notifications"
          message="Notifications about the club will appear here."
        />
      ) : (
        <Card>
          <CardBody className="divide-y divide-line px-0 dark:divide-white/10">
            {rows.map((n) => (
              <button
                key={n.id}
                onClick={() => void open(n)}
                className={cn(
                  "flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
                  !n.readAt && "bg-accent-soft/40 dark:bg-white/5"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                    TONES[n.type] || TONES.GENERAL
                  )}
                >
                  <Icon name={ICONS[n.type] || "bell"} size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14.5px] font-semibold text-ink dark:text-slate-100">
                      {n.title}
                    </p>
                    {!n.readAt && <span className="size-2 rounded-full bg-accent" />}
                  </div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-sub dark:text-slate-400">
                    {n.message}
                  </p>
                  <p className="mt-1 text-[11.5px] text-faint dark:text-slate-400">{timeAgo(n.createdAt)}</p>
                </div>
              </button>
            ))}
          </CardBody>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pager
            page={pagination.page}
            totalPages={pagination.totalPages}
            onChange={(p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}
    </div>
  );
}
