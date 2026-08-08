"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { Member, Pagination, PromotionRequest, Role } from "@/lib/types";
import {
  timeAgo,
} from "@/lib/format";
import { Icon } from "@/components/icons";
import { Button, ActionIcon } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Grid } from "@/components/ui/layout";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Modal } from "@/components/ui/modal";
import { Pagination as Pager } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useRealtimeRefresh } from "@/lib/client/socket";
import { RequirePermission } from "@/components/require-permission";

type Filter = "all" | "DRAFT" | "SUBMITTED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

interface PromotionRow extends PromotionRequest {
  member: { id: string; user: { id: string; name: string; email: string } };
}

function PromotionsPage() {
  const { user } = useSession();
  const toast = useToast();
  const perms = user?.permissions ?? [];
  const canSubmit = perms.includes("promotion.submit");
  const canApprove = perms.includes("promotion.approve");

  const [rows, setRows] = useState<PromotionRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<PromotionRow | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (page > 1) params.set("page", String(page));
      const data = await apiGet<{ promotions: PromotionRow[]; pagination: Pagination }>(
        `/api/promotions?${params.toString()}`
      );
      setRows(data.promotions);
      setPagination(data.pagination);
      setAccessDenied(false);
    } catch (err) {
      if (err instanceof Error && err.message === "Forbidden") {
        setAccessDenied(true);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Live: refresh the queue when requests are submitted/decided in real time.
  useRealtimeRefresh(["PromotionRequest", "Role", "Member"], load);

  const submit = async (id: string) => {
    try {
      await apiPost(`/api/promotions/${id}/submit`);
      toast.success("Promotion submitted for review");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    }
  };

  const decide = async (id: string, status: string) => {
    try {
      await apiPost(`/api/promotions/${id}/decision`, { status });
      toast.success(status === "APPROVED" ? "Promotion approved" : "Promotion rejected");
      setViewing(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Decision failed");
    }
  };

  const actionable = rows.filter((r) =>
    ["SUBMITTED", "PENDING_APPROVAL"].includes(r.status)
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon="trend"
        title="Promotions"
        subtitle={
          actionable > 0
            ? `${actionable} request${actionable === 1 ? "" : "s"} awaiting review`
            : "Track promotion requests"
        }
        actions={
          canSubmit && (
            <Button icon="trend" onClick={() => setCreating(true)}>
              New Promotion Request
            </Button>
          )
        }
      />

      <Segmented<Filter>
        scrollable
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
        options={[
          { value: "all", label: "All" },
          { value: "SUBMITTED", label: "Submitted" },
          { value: "PENDING_APPROVAL", label: "Pending approval" },
          { value: "APPROVED", label: "Approved" },
          { value: "REJECTED", label: "Rejected" },
          { value: "DRAFT", label: "Drafts" },
        ]}
      />

      {accessDenied ? (
        <EmptyState
          icon="lock"
          title="Promotions unavailable"
          message="You need the promotion.submit or promotion.approve permission to view promotion requests."
        />
      ) : loading && !rows.length ? (
        <PageLoader label="Loading promotions…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="trend"
          title="No promotion requests"
          message="Promotions let members move up through club roles."
        />
      ) : (
        <Card>
          <CardBody className="divide-y divide-line px-0 dark:divide-white/10">
            {rows.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 px-5 py-3.5"
              >
                <Avatar name={p.member?.user?.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-ink dark:text-slate-100">
                    {p.member?.user?.name ?? "Member"}
                  </p>
                  <p className="truncate text-[12.5px] text-sub dark:text-slate-400">
                    {p.member?.user?.email} · submitted {timeAgo(p.createdAt)}
                  </p>
                  {p.reason && (
                    <p className="mt-0.5 line-clamp-1 text-[12.5px] text-faint">
                      {p.reason}
                    </p>
                  )}
                </div>
                <div className="hidden items-center gap-2 md:flex">
                  {p.status === "DRAFT" && canSubmit && (
                    <Button size="sm" variant="secondary" onClick={() => void submit(p.id)}>
                      Submit
                    </Button>
                  )}
                  {["SUBMITTED", "PENDING_APPROVAL"].includes(p.status) && canApprove && (
                    <>
                      <Button size="sm" variant="danger" onClick={() => void decide(p.id, "REJECTED")}>
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => void decide(p.id, "APPROVED")}>
                        Approve
                      </Button>
                    </>
                  )}
                </div>
                <StatusPill value={p.status} />
                <ActionIcon icon="eye" label="View promotion" size="xs" onClick={() => setViewing(p)} />
              </div>
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

      {creating && (
        <CreatePromotionModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      )}

      {viewing && (
        <PromotionModal
          promotion={viewing}
          onClose={() => setViewing(null)}
          onDecide={(s) => void decide(viewing.id, s)}
          canApprove={canApprove}
          canSubmit={canSubmit}
          onSubmitted={() => {
            setViewing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

export default function PromotionsPageRoute() {
  return (
    <RequirePermission anyOf={["promotion.submit", "promotion.approve"]}>
      <PromotionsPage />
    </RequirePermission>
  );
}

/* ---------------- Create ---------------- */

function CreatePromotionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState({
    memberId: "",
    currentRoleId: "",
    proposedRoleId: "",
    reason: "",
    achievements: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([
      apiGet<{ members: Member[] }>("/api/members?limit=200"),
      apiGet<Role[]>("/api/roles"),
    ])
      .then(([m, r]) => {
        setMembers(m.members);
        setRoles(r);
      })
      .catch(() => toast.error("Couldn't load members and roles"));
  }, [toast]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.memberId || !form.currentRoleId || !form.proposedRoleId || !form.reason.trim()) {
      toast.error("Member, current role, proposed role and reason are required");
      return;
    }
    if (form.currentRoleId === form.proposedRoleId) {
      toast.error("Proposed role must differ from the current role");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/promotions", {
        memberId: form.memberId,
        currentRoleId: form.currentRoleId,
        proposedRoleId: form.proposedRoleId,
        reason: form.reason.trim(),
        ...(form.achievements ? { achievements: form.achievements } : {}),
      });
      toast.success("Promotion request created");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New Promotion Request" size="lg">
      <form onSubmit={save} className="space-y-4">
        <Field label="Member to promote">
          <Select value={form.memberId} onChange={(v) => setForm({ ...form, memberId: v })}>
            <option value="">Select member…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.name} · {m.memberCode}
              </option>
            ))}
          </Select>
        </Field>
        <Grid preset="fields">
          <Field label="Current role">
            <Select value={form.currentRoleId} onChange={(v) => setForm({ ...form, currentRoleId: v })}>
              <option value="">Select role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Proposed role">
            <Select value={form.proposedRoleId} onChange={(v) => setForm({ ...form, proposedRoleId: v })}>
              <option value="">Select role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </Grid>
        <Field label="Reason">
          <Textarea
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Why does this member deserve the promotion?"
          />
        </Field>
        <Field label="Achievements" optional>
          <Textarea
            value={form.achievements}
            onChange={(e) => setForm({ ...form, achievements: e.target.value })}
            placeholder="Notable contributions, awards, dedication…"
          />
        </Field>
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" full type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button full type="submit" loading={saving}>
            Create Request
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Detail ---------------- */

function PromotionModal({
  promotion,
  onClose,
  onDecide,
  canApprove,
  canSubmit,
  onSubmitted,
}: {
  promotion: PromotionRow;
  onClose: () => void;
  onDecide: (status: string) => void;
  canApprove: boolean;
  canSubmit: boolean;
  onSubmitted: () => void;
}) {
  const toast = useToast();
  const [deciding, setDeciding] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const approve = async (status: string) => {
    setDeciding(true);
    try {
      onDecide(status);
    } finally {
      setDeciding(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Promotion Request"
      subtitle={promotion.member?.user?.name}
      size="lg"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <StatusPill value={promotion.status} />
          <span className="text-[12.5px] text-faint">Submitted {timeAgo(promotion.createdAt)}</span>
        </div>

        <Grid preset="split">
          <div className="rounded-2xl border border-line px-4 py-3.5 dark:border-white/10">
            <p className="text-[11px] font-medium uppercase tracking-wide text-faint">Member</p>
            <p className="mt-0.5 text-[14.5px] font-semibold text-ink dark:text-slate-100">
              {promotion.member?.user?.name}
            </p>
            <p className="text-[12.5px] text-sub dark:text-slate-400">
              {promotion.member?.user?.email}
            </p>
          </div>
          <div className="rounded-2xl border border-line px-4 py-3.5 dark:border-white/10">
            <p className="text-[11px] font-medium uppercase tracking-wide text-faint">Requested move</p>
            <p className="mt-0.5 text-[14.5px] font-semibold text-ink dark:text-slate-100">
              {promotion.currentRole?.name ?? "Member"} →{" "}
              <span className="text-accent">{promotion.proposedRole?.name}</span>
            </p>
          </div>
        </Grid>

        {promotion.reason && (
          <div className="rounded-2xl border border-line p-4 dark:border-white/10">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">Reason</p>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink dark:text-slate-200">
              {promotion.reason}
            </p>
          </div>
        )}

        {promotion.achievements && (
          <div className="rounded-2xl border border-line p-4 dark:border-white/10">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
              Achievements
            </p>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink dark:text-slate-200">
              {promotion.achievements}
            </p>
          </div>
        )}

        {promotion.documentUrls && promotion.documentUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {promotion.documentUrls.map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-3.5 py-1.5 text-[12.5px] font-medium text-accent transition hover:bg-black/[0.08] dark:bg-white/10"
              >
                <Icon name="link" size={13} /> View document
              </a>
            ))}
          </div>
        )}

        {promotion.status === "DRAFT" && canSubmit && (
          <div className="flex gap-3 border-t border-line pt-4 dark:border-white/10">
            <Button
              full
              loading={submitting}
              onClick={() => {
                setSubmitting(true);
                void apiPost(`/api/promotions/${promotion.id}/submit`)
                  .then(() => {
                    toast.success("Submitted for review");
                    onSubmitted();
                  })
                  .catch((e) => {
                    toast.error(e instanceof Error ? e.message : "Submit failed");
                    setSubmitting(false);
                  });
              }}
            >
              Submit for Review
            </Button>
          </div>
        )}

        {["SUBMITTED", "PENDING_APPROVAL"].includes(promotion.status) && canApprove && (
          <div className="flex gap-3 border-t border-line pt-4 dark:border-white/10">
            <Button variant="danger" full loading={deciding} onClick={() => void approve("REJECTED")}>
              Reject
            </Button>
            <Button full loading={deciding} onClick={() => void approve("APPROVED")}>
              Approve
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
