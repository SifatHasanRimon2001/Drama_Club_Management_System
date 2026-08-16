"use client";

import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch } from "@/lib/client/api";
import type { Pagination } from "@/lib/types";
import { formatDateTime, timeAgo } from "@/lib/format";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Segmented } from "@/components/ui/segmented";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Pagination as Pager } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { useRealtimeRefresh } from "@/lib/client/socket";
import { RequirePermission } from "@/components/require-permission";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  handledAt: string | null;
}

type Filter = "all" | "open" | "handled";

function ContactMessagesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ContactMessage[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("open");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<ContactMessage | null>(null);
  const [deleting, setDeleting] = useState<ContactMessage | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: filter });
      if (page > 1) params.set("page", String(page));
      const data = await apiGet<{ submissions: ContactMessage[]; pagination: Pagination }>(
        `/api/contacts?${params.toString()}`
      );
      setRows(data.submissions);
      setPagination(data.pagination);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [filter, page, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Live: new contact form submissions arrive in real time.
  useRealtimeRefresh(["ContactSubmission"], load);

  const setHandled = async (m: ContactMessage, handled: boolean) => {
    setBusy(true);
    try {
      await apiPatch(`/api/contacts/${m.id}`, { handled });
      toast.success(handled ? "Marked as handled" : "Reopened");
      setViewing((v) => (v && v.id === m.id ? { ...v, handledAt: handled ? new Date().toISOString() : null } : v));
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiDelete(`/api/contacts/${deleting.id}`);
      toast.success("Message deleted");
      setViewing((v) => (v && v.id === deleting.id ? null : v));
      setDeleting(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (    <div className="space-y-6">
      <PageHeader
        icon="mail"
        title="Contact Messages"
        subtitle="Messages sent from the public contact page"
      />

      <Segmented<Filter>
        scrollable
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
        options={[
          { value: "open", label: "Open" },
          { value: "handled", label: "Handled" },
          { value: "all", label: "All" },
        ]}
      />

      {loading && !rows.length ? (
        <PageLoader label="Loading messages…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="mail"
          title="No messages here"
          message={
            filter === "open"
              ? "You're all caught up — no unhandled messages."
              : "Nothing matches this filter yet."
          }
        />
      ) : (
        <Card>
          <CardBody className="divide-y divide-line px-0 dark:divide-white/10">
            {rows.map((m) => (
              <button
                key={m.id}
                onClick={() => setViewing(m)}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              >
                <Avatar name={m.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14.5px] font-semibold text-ink">
                      {m.name}
                    </p>
                    {m.handledAt ? (
                      <span className="shrink-0 rounded-full bg-green/12 px-2 py-0.5 text-[11px] font-semibold text-green dark:bg-green/20 dark:text-green-300">
                        Handled
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-orange/12 px-2 py-0.5 text-[11px] font-semibold text-orange dark:bg-orange/20 dark:text-orange-400">
                        Open
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[12.5px] text-sub">
                    {m.email} · {timeAgo(m.createdAt)}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[13px] text-ink/80">
                    {m.message}
                  </p>
                </div>
                <Icon name="chevron-right" size={16} className="shrink-0 text-faint" />
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

      {viewing && (
        <Modal
          open
          onClose={() => setViewing(null)}
          title={
            <span className="flex items-center gap-2.5">
              <Avatar name={viewing.name} size={28} />
              {viewing.name}
            </span>
          }
          subtitle={`${viewing.email} · ${formatDateTime(viewing.createdAt)}`}
          footer={
            <>
              <Button
                variant="ghost"
                icon="trash"
                className="mr-auto text-red hover:bg-red/10"
                onClick={() => setDeleting(viewing)}
                disabled={busy}
              >
                Delete
              </Button>
              <Button
                variant={viewing.handledAt ? "secondary" : "primary"}
                icon={viewing.handledAt ? "flag" : "check"}
                loading={busy}
                onClick={() => void setHandled(viewing, !viewing.handledAt)}
              >
                {viewing.handledAt ? "Reopen" : "Mark as Handled"}
              </Button>
            </>
          }
        >
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
            {viewing.message}
          </p>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete message"
        message={`Delete the message from ${deleting?.name ?? "this sender"}? This can't be undone.`}
        loading={busy}
      />
    </div>
  );
}

export default function ContactMessagesPageRoute() {
  return (
    <RequirePermission permission="settings.manage">
      <ContactMessagesPage />
    </RequirePermission>
  );
}
