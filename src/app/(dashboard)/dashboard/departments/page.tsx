"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { Committee, Department, Member } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Button, ActionIcon } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Grid } from "@/components/ui/layout";
import { PageHeader } from "@/components/ui/page";
import { Avatar } from "@/components/ui/avatar";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRealtimeRefresh } from "@/lib/client/socket";
import { RequirePermission } from "@/components/require-permission";

interface DepartmentRow extends Department {
  committee: { id: string; year: string; isCurrent: boolean };
}

function DepartmentsPage() {
  const { user } = useSession();
  const canManage = user?.permissions?.includes("department.manage") ?? false;

  const [depts, setDepts] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DepartmentRow | null>(null);
  const [deleting, setDeleting] = useState<DepartmentRow | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDepts(await apiGet<DepartmentRow[]>("/api/departments"));
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load departments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Live: reflect department/committee/member changes in real time.
  useRealtimeRefresh(["Department", "Committee", "Member", "MemberDepartment"], load);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await apiDelete(`/api/departments/${deleting.id}`);
      toast.success("Department deleted");
      setDeleting(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="grid"
        title="Departments"
        subtitle={`${depts.length} departments across club committees`}
        actions={
          canManage && (
            <Button icon="plus" onClick={() => setCreating(true)}>
              New Department
            </Button>
          )
        }
      />

      {loading ? (
        <PageLoader label="Loading departments…" />
      ) : loadError ? (
        <EmptyState
          icon="warn"
          title="Couldn't load departments"
          message={loadError}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : depts.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No departments yet"
          message="Create your first department to start organizing."
        />
      ) : (
        <Grid preset="cards">
          {depts.map((d) => (
            <div
              key={d.id}
              className="flex flex-col rounded-apple border border-line bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-card-hover dark:border-white/10 dark:bg-card"
            >
              <Link href={`/dashboard/departments/${d.id}`} className="group block">
                <div className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink dark:bg-accent/20">
                    <Icon name="folder" size={20} />
                  </span>
                  {d.committee.isCurrent && (
                    <span className="rounded-full bg-green/12 px-2.5 py-1 text-[11px] font-semibold text-green dark:bg-green/20 dark:text-green-300">
                      Current
                    </span>
                  )}
                </div>
                <h3 className="mt-4 truncate text-[16.5px] font-bold tracking-tight text-ink group-hover:text-accent dark:text-slate-100">
                  {d.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-sub dark:text-slate-400">
                  {d.description || "No description yet."}
                </p>
                <div className="mt-4 flex items-center gap-3 text-[12.5px] text-sub dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Icon name="members" size={14} />
                    {d._count?.members ?? 0} members
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon name="calendar" size={14} />
                    {d._count?.events ?? 0} events
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon name="tasks" size={14} />
                    {d._count?.tasks ?? 0} tasks
                  </span>
                </div>
              </Link>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4 dark:border-white/10">
                <div className="min-w-0 flex items-center gap-2 rounded-xl bg-black/[0.03] px-3 py-2 dark:bg-white/5">
                  {d.coordinator ? (
                    <>
                      <Avatar name={d.coordinator.user.name} size={22} />
                      <div className="min-w-0 leading-tight">
                        <p className="text-[11px] text-faint">Coordinator</p>
                        <p className="truncate text-[12.5px] font-semibold text-ink dark:text-slate-200">
                          {d.coordinator.user.name}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-[12px] text-faint">No coordinator</p>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(d)}>
                      Edit
                    </Button>
                    <ActionIcon
                      icon="trash"
                      label={`Delete ${d.name}`}
                      size="xs"
                      className="hover:bg-red/10 hover:text-red dark:hover:bg-red/20 dark:hover:text-red-300"
                      onClick={() => setDeleting(d)}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </Grid>
      )}

      {(creating || editing) && (
        <DepartmentModal
          department={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            void load();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open
          title="Delete department?"
          message={`"${deleting.name}" will be removed. Departments that still have events or tasks can't be deleted — reassign or delete those first.`}
          confirmLabel="Delete"
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

export default function DepartmentsPageRoute() {
  return (
    <RequirePermission permission="department.view">
      <DepartmentsPage />
    </RequirePermission>
  );
}

function DepartmentModal({
  department,
  onClose,
  onSaved,
}: {
  department: DepartmentRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: department?.name ?? "",
    description: department?.description ?? "",
    committeeId: department?.committee?.id ?? "",
    coordinatorId: department?.coordinator?.id ?? "",
  });

  useEffect(() => {
    void Promise.all([
      apiGet<Committee[]>("/api/committees"),
      apiGet<{ members: Member[] }>("/api/members?limit=200"),
    ])
      .then(([cs, m]) => {
        setCommittees(cs);
        setMembers(m.members);
        if (!department) {
          const current = cs.find((c) => c.isCurrent);
          if (current) setForm((f) => ({ ...f, committeeId: current.id }));
        }
      })
      .catch(() => toast.error("Couldn't load committees and members"));
  }, [department, toast]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.committeeId) {
      toast.error("Name and committee are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        ...(form.description ? { description: form.description } : {}),
        committeeId: form.committeeId,
        ...(form.coordinatorId ? { coordinatorId: form.coordinatorId } : {}),
      };
      if (department) {
        await apiPatch(`/api/departments/${department.id}`, payload);
        toast.success("Department updated");
      } else {
        await apiPost("/api/departments", payload);
        toast.success("Department created");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={department ? "Edit Department" : "New Department"}
      size="lg"
    >
      <form onSubmit={save} className="space-y-4">
        <Grid preset="fields">
          <Field label="Name">
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Stage Production"
            />
          </Field>
          <Field label="Committee">
            <Select
              value={form.committeeId}
              onChange={(v) => setForm({ ...form, committeeId: v })}
            >
              <option value="">Select committee…</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.year} committee{c.isCurrent ? " (current)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        </Grid>
        <Field label="Description" optional>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What does this department do?"
          />
        </Field>
        <Field label="Coordinator" optional hint="A member who leads this department">
          <Select
            value={form.coordinatorId}
            onChange={(v) => setForm({ ...form, coordinatorId: v })}
          >
            <option value="">— None —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.name} · {m.memberCode}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" full type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button full type="submit" loading={saving}>
            {department ? "Save Changes" : "Create Department"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
