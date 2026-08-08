"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { Icon, type IconName } from "@/components/icons";
import { Button, ActionIcon } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { Avatar } from "@/components/ui/avatar";
import { useRealtimeRefresh } from "@/lib/client/socket";
import { RequirePermission } from "@/components/require-permission";

interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

const PAGE_SIZE = 25;

const ENTITY_META: Record<string, { icon: IconName; tone: string }> = {
  Member: { icon: "members", tone: "bg-blue/12 text-blue dark:bg-blue/20 dark:text-blue-300" },
  User: { icon: "user", tone: "bg-blue/12 text-blue dark:bg-blue/20 dark:text-blue-300" },
  Role: { icon: "shield", tone: "bg-red/12 text-red dark:bg-red/20 dark:text-red-300" },
  Permission: { icon: "shield", tone: "bg-red/12 text-red dark:bg-red/20 dark:text-red-300" },
  Committee: { icon: "trophy", tone: "bg-purple/12 text-purple dark:bg-purple/20 dark:text-purple-300" },
  CommitteeMemberRole: { icon: "role", tone: "bg-purple/12 text-purple dark:bg-purple/20 dark:text-purple-300" },
  Department: { icon: "folder", tone: "bg-teal/12 text-teal dark:bg-teal/20 dark:text-teal-300" },
  Task: { icon: "tasks", tone: "bg-orange/12 text-orange dark:bg-orange/20 dark:text-orange-300" },
  RegistrationWindow: { icon: "window", tone: "bg-orange/12 text-orange dark:bg-orange/20 dark:text-orange-300" },
  Applicant: { icon: "user", tone: "bg-pink/12 text-pink dark:bg-pink/20 dark:text-pink-300" },
  PromotionRequest: { icon: "trend", tone: "bg-green/12 text-green dark:bg-green/20 dark:text-green-300" },
  Event: { icon: "calendar", tone: "bg-blue/12 text-blue dark:bg-blue/20 dark:text-blue-300" },
  ClubUpdate: { icon: "note", tone: "bg-indigo/12 text-indigo dark:bg-indigo/20 dark:text-indigo-300" },
  GalleryAlbum: { icon: "gallery", tone: "bg-pink/12 text-pink dark:bg-pink/20 dark:text-pink-300" },
  GalleryItem: { icon: "image", tone: "bg-pink/12 text-pink dark:bg-pink/20 dark:text-pink-300" },
  SystemSetting: { icon: "settings", tone: "bg-black/[0.06] text-sub dark:bg-white/10 dark:text-slate-300" },
  Notification: { icon: "bell", tone: "bg-yellow/12 text-yellow dark:bg-yellow/20 dark:text-yellow-300" },
  ContactSubmission: { icon: "mail", tone: "bg-black/[0.06] text-sub dark:bg-white/10 dark:text-slate-300" },
};

const ACTION_TONES: Record<string, string> = {
  approved: "bg-green/12 text-green dark:bg-green/20 dark:text-green-300",
  accepted: "bg-green/12 text-green dark:bg-green/20 dark:text-green-300",
  rejected: "bg-red/12 text-red dark:bg-red/20 dark:text-red-300",
  deleted: "bg-red/12 text-red dark:bg-red/20 dark:text-red-300",
  blocked: "bg-red/12 text-red dark:bg-red/20 dark:text-red-300",
  created: "bg-blue/12 text-blue dark:bg-blue/20 dark:text-blue-300",
  updated: "bg-orange/12 text-orange dark:bg-orange/20 dark:text-orange-300",
  submitted: "bg-purple/12 text-purple dark:bg-purple/20 dark:text-purple-300",
  converted: "bg-teal/12 text-teal dark:bg-teal/20 dark:text-teal-300",
};

function actionTone(action: string): string {
  for (const [key, tone] of Object.entries(ACTION_TONES)) {
    if (action.endsWith(key)) return tone;
  }
  return "bg-black/[0.06] text-sub dark:bg-white/10 dark:text-slate-300";
}

function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (action) params.set("action", action);
      if (entityType) params.set("entityType", entityType);
      const data = await apiGet<{
        entries: AuditEntry[];
        pagination: { total: number; totalPages: number };
        filters: { actions: string[]; entityTypes: string[] };
      }>(`/api/audit-log?${params.toString()}`);
      setEntries(data.entries);
      setTotal(data.pagination.total);
      setTotalPages(Math.max(1, data.pagination.totalPages));
      setActions(data.filters.actions);
      setEntityTypes(data.filters.entityTypes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the audit log");
    } finally {
      setLoading(false);
    }
  }, [page, action, entityType]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Live: stream new admin actions into the trail in real time.
  useRealtimeRefresh(["AuditLog"], load, 500);

  const filtered = useMemo(
    () => action !== "" || entityType !== "",
    [action, entityType]
  );

  const clearFilters = () => {
    setAction("");
    setEntityType("");
    setPage(1);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="shield"
        title="Audit Log"
        subtitle="A complete trail of admin actions across the system."
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <Field label="Action">
              <Select value={action} onChange={(v) => { setAction(v); setPage(1); }}>
                <option value="">All actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="w-full sm:w-64">
            <Field label="Entity type">
              <Select value={entityType} onChange={(v) => { setEntityType(v); setPage(1); }}>
                <option value="">All entities</option>
                {entityTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>
          {filtered && (
            <Button variant="subtle" size="sm" onClick={clearFilters} icon="close">
              Clear filters
            </Button>
          )}
          <div className="ml-auto text-[13px] text-sub dark:text-slate-400">
            {total.toLocaleString()} {total === 1 ? "event" : "events"}
          </div>
        </div>
      </Card>

      {loading ? (
        <PageLoader label="Loading audit log…" />
      ) : error ? (
        <EmptyState
          icon="warn"
          title="Couldn't load the audit log"
          message={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon="list"
          title={filtered ? "No events match your filters" : "No audit events yet"}
          message={
            filtered
              ? "Try clearing the filters to see everything."
              : "Admin actions will appear here as they happen."
          }
        />
      ) : (
        <Card className="divide-y divide-line dark:divide-white/10">
          {entries.map((entry) => {
            const meta = ENTITY_META[entry.entityType] || {
              icon: "list" as IconName,
              tone: "bg-black/[0.06] text-sub dark:bg-white/10 dark:text-slate-300",
            };
            const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;
            const isOpen = expanded.has(entry.id);
            return (
              <div key={entry.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-3">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", meta.tone)}>
                    <Icon name={meta.icon} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[14px] font-semibold text-ink dark:text-slate-100">
                        {entry.action}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", actionTone(entry.action))}>
                        {entry.action.split(".").pop()}
                      </span>
                      <span className="text-[12.5px] text-sub dark:text-slate-400">
                        {entry.entityType}
                        <span className="ml-1 font-mono text-[11.5px] text-faint">
                          {entry.entityId.slice(0, 10)}…
                        </span>
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-sub dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar name={entry.actorName} size={16} />
                        {entry.actorName}
                      </span>
                      <span className="text-faint">{formatDateTime(entry.createdAt)}</span>
                    </div>
                  </div>
                  {hasMetadata && (
                    <ActionIcon
                      icon="chevron-down"
                      label={isOpen ? "Hide details" : "Show details"}
                      size="xs"
                      onClick={() => toggleExpand(entry.id)}
                      className={cn("transition-transform duration-200", isOpen && "rotate-180")}
                    />
                  )}
                </div>
                {hasMetadata && isOpen && (
                  <pre className="thin-scroll mt-3 overflow-x-auto rounded-xl bg-black/[0.04] p-3 font-mono text-[12px] leading-relaxed text-sub dark:bg-white/5 dark:text-slate-300">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {!loading && !error && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  );
}

export default function AuditPageRoute() {
  return (
    <RequirePermission permission="permissions.manage">
      <AuditPage />
    </RequirePermission>
  );
}
