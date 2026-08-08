"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { Department, Member, Task } from "@/lib/types";
import { formatDateTime, TASK_STATUSES, taskStatusLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { Dropdown } from "@/components/ui/dropdown";
import { ActionIcon } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Grid } from "@/components/ui/layout";
import { BackLink } from "@/components/ui/page";
import { useRealtimeRefresh } from "@/lib/client/socket";
import { RequirePermission } from "@/components/require-permission";

type Tab = "overview" | "tasks" | "members";

interface FullDepartment extends Omit<Department, "members"> {
  coordinator: { id: string; user: { id: string; name: string; email: string; image: string | null } } | null;
  members: { member: Member }[];
}

function DepartmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useSession();
  const toast = useToast();
  const canManage = user?.permissions?.includes("department.manage") ?? false;

  const [dept, setDept] = useState<FullDepartment | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [taskModal, setTaskModal] = useState<{ open: boolean; task?: Task }>({ open: false });
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, t, m] = await Promise.all([
        apiGet<FullDepartment>(`/api/departments/${id}`),
        apiGet<Task[]>(`/api/departments/${id}/tasks`),
        apiGet<{ members: Member[] }>("/api/members?limit=100"),
      ]);
      setDept(d);
      setTasks(t);
      setAllMembers(m.members);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load department");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Live: keep tasks, members and department details fresh in real time.
  useRealtimeRefresh(
    ["Department", "Task", "Member", "MemberDepartment", "CommitteeMemberRole"],
    load
  );

  const memberIds = useMemo(
    () => new Set(dept?.members.map((md) => md.member.id) ?? []),
    [dept]
  );
  const members = dept?.members.map((md) => md.member) ?? [];
  const assignable = allMembers.filter((m) => m.id !== dept?.coordinatorId);

  const taskCounts = useMemo(
    () => ({
      TODO: tasks.filter((t) => t.status === "TODO").length,
      IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      DONE: tasks.filter((t) => t.status === "DONE").length,
    }),
    [tasks]
  );

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      await apiPatch(`/api/departments/${id}/tasks/${taskId}`, { status });
      toast.success("Task updated");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      await apiDelete(`/api/members/${memberId}/departments?departmentId=${id}`);
      toast.success("Member removed");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    }
  };

  const deleteTask = async () => {
    if (!deleteTaskId) return;
    try {
      await apiDelete(`/api/departments/${id}/tasks/${deleteTaskId}`);
      toast.success("Task deleted");
      setDeleteTaskId(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (loading && !dept) return <PageLoader label="Loading department…" />;
  if (loadError)
    return (
      <EmptyState
        icon="warn"
        title="Couldn't load this department"
        message={loadError}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        }
      />
    );
  if (!dept)
    return (
      <EmptyState
        icon="warn"
        title="Department not found"
        message="It may have been archived."
        action={
          <Link href="/dashboard/departments">
            <Button>Back to departments</Button>
          </Link>
        }
      />
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <BackLink href="/dashboard/departments" className="mb-2">
            All departments
          </BackLink>
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-bold tracking-tight text-ink dark:text-slate-100">
              {dept.name}
            </h1>
            {dept.committee?.isCurrent && (
              <span className="rounded-full bg-green/12 px-2.5 py-1 text-[11px] font-semibold text-green dark:bg-green/20 dark:text-green-300">
                Current
              </span>
            )}
          </div>
          <p className="mt-1 text-[13.5px] text-sub dark:text-slate-400">
            {dept.committee?.year ? `${dept.committee.year} committee` : "Committee"} ·{" "}
            {members.length} members · {tasks.length} tasks
          </p>
        </div>
      </div>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Overview" },
          { value: "tasks", label: `Tasks (${taskCounts.TODO + taskCounts.IN_PROGRESS})` },
          { value: "members", label: `Members (${members.length})` },
        ]}
      />

      {tab === "overview" && (
        <Grid preset="detail">
          <Card className="min-w-0 lg:col-span-2">
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-[14px] leading-relaxed text-ink dark:text-slate-300">
                {dept.description || "No description provided for this department yet."}
              </p>
            </CardBody>
          </Card>
          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Coordinator</CardTitle>
              </CardHeader>
              <CardBody>
                {dept.coordinator ? (
                  <div className="flex items-center gap-3">
                    <Avatar name={dept.coordinator.user.name} src={dept.coordinator.user.image} size={44} />
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-semibold text-ink dark:text-slate-100">
                        {dept.coordinator.user.name}
                      </p>
                      <p className="truncate text-[12.5px] text-sub dark:text-slate-400">
                        {dept.coordinator.user.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13.5px] text-sub dark:text-slate-400">
                    No coordinator assigned yet.
                  </p>
                )}
              </CardBody>
            </Card>
            <Grid preset="stats3">
              <div className="rounded-apple border border-line bg-card p-4 text-center shadow-card dark:border-white/10 dark:bg-[#0f172a]">
                <p className="text-[22px] font-bold tabular-nums text-ink dark:text-slate-100">
                  {members.length}
                </p>
                <p className="text-[11.5px] font-medium text-faint dark:text-slate-400">Members</p>
              </div>
              <div className="rounded-apple border border-line bg-card p-4 text-center shadow-card dark:border-white/10 dark:bg-[#0f172a]">
                <p className="text-[22px] font-bold tabular-nums text-ink dark:text-slate-100">
                  {dept._count?.events ?? 0}
                </p>
                <p className="text-[11.5px] font-medium text-faint dark:text-slate-400">Events</p>
              </div>
              <div className="rounded-apple border border-line bg-card p-4 text-center shadow-card dark:border-white/10 dark:bg-[#0f172a]">
                <p className="text-[22px] font-bold tabular-nums text-ink dark:text-slate-100">
                  {taskCounts.DONE}/{tasks.length}
                </p>
                <p className="text-[11.5px] font-medium text-faint dark:text-slate-400">Tasks done</p>
              </div>
            </Grid>
          </div>
        </Grid>
      )}

      {tab === "tasks" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Tasks</CardTitle>
            {canManage && (
              <Button size="sm" icon="plus" onClick={() => setTaskModal({ open: true })}>
                New Task
              </Button>
            )}
          </CardHeader>
          <CardBody className="space-y-2">
            {tasks.length === 0 ? (
              <EmptyState
                icon="tasks"
                title="No tasks yet"
                message="Create tasks to organize the department's work."
              />
            ) : (
              tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 dark:border-white/10"
                >
                  <button
                    onClick={() =>
                      canManage &&
                      updateTaskStatus(t.id, t.status === "DONE" ? "TODO" : "DONE")
                    }
                    disabled={!canManage}
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition",
                      t.status === "DONE"
                        ? "border-green bg-green text-white"
                        : "border-line-strong text-transparent hover:border-accent disabled:opacity-40",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    )}
                    aria-label={t.status === "DONE" ? "Mark task as not done" : "Mark task as done"}
                    aria-pressed={t.status === "DONE"}
                  >
                    <Icon name="check" size={11} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-[14px] font-semibold text-ink dark:text-slate-100",
                        t.status === "DONE" && "text-faint line-through"
                      )}
                    >
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="mt-0.5 line-clamp-1 text-[12.5px] text-sub dark:text-slate-400">
                        {t.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11.5px] text-faint dark:text-slate-400">
                      {t.dueDate ? `Due ${formatDateTime(t.dueDate)}` : "No due date"}
                      {t.assignee ? ` · ${t.assignee.user.name}` : ""}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Dropdown
                        width="w-40"
                        trigger={(open, toggle) => (
                          <button
                            onClick={toggle}
                            className={cn(
                              "flex size-8 items-center justify-center rounded-full transition",
                              open
                                ? "bg-black/[0.07] dark:bg-white/15"
                                : "text-faint hover:bg-black/[0.05] hover:text-ink dark:hover:bg-white/10 dark:hover:text-slate-200"
                            )}
                            aria-label="Task actions"
                          >
                            <Icon name="dots" size={16} />
                          </button>
                        )}
                      >
                        {(close) => (
                          <div className="p-1.5">
                            {TASK_STATUSES.map((s) => (
                              <button
                                key={s}
                                onClick={() => {
                                  updateTaskStatus(t.id, s);
                                  close();
                                }}
                                className={cn(
                                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition hover:bg-black/[0.05] dark:hover:bg-white/10",
                                  t.status === s
                                    ? "text-accent"
                                    : "text-ink dark:text-slate-200"
                                )}
                              >
                                <span className="size-1.5 rounded-full bg-current" />
                                {taskStatusLabel(s)}
                              </button>
                            ))}
                          </div>
                        )}
                      </Dropdown>
                      <ActionIcon
                        icon="edit"
                        label="Edit task"
                        size="xs"
                        onClick={() => {
                          setTaskModal({ open: true, task: t });
                        }}
                      />
                      <ActionIcon
                        icon="trash"
                        label="Delete task"
                        size="xs"
                        className="hover:bg-red/10 hover:text-red dark:hover:bg-red/20 dark:hover:text-red-300"
                        onClick={() => setDeleteTaskId(t.id)}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </CardBody>
        </Card>
      )}

      {tab === "members" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Members</CardTitle>
            {canManage && (
              <Button size="sm" icon="plus" onClick={() => setAddMemberOpen(true)}>
                Add Member
              </Button>
            )}
          </CardHeader>
          <CardBody className="divide-y divide-line px-0 dark:divide-white/10">
            {members.length === 0 ? (
              <EmptyState
                icon="members"
                title="No members yet"
                message="Add members to this department."
              />
            ) : (
              members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  <Avatar name={m.user.name} src={m.user.image} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink dark:text-slate-100">
                      {m.user.name}
                      {dept.coordinatorId === m.id && (
                        <span className="ml-2 rounded-full bg-purple/12 px-2 py-0.5 text-[10.5px] font-semibold text-purple dark:bg-purple/20 dark:text-purple-300">
                          Coordinator
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[12.5px] text-sub dark:text-slate-400">
                      {m.memberCode} · {m.user.email}
                    </p>
                  </div>
                  <StatusPill value={m.status} />
                  {canManage && dept.coordinatorId !== m.id && (
                    <ActionIcon
                      icon="close"
                      label="Remove member"
                      size="xs"
                      className="hover:bg-red/10 hover:text-red dark:hover:bg-red/20 dark:hover:text-red-300"
                      onClick={() => void removeMember(m.id)}
                    />
                  )}
                </div>
              ))
            )}
          </CardBody>
        </Card>
      )}

      {taskModal.open && (
        <TaskModal
          departmentId={id}
          task={taskModal.task}
          members={assignable}
          onClose={() => setTaskModal({ open: false })}
          onSaved={() => {
            setTaskModal({ open: false });
            void load();
          }}
        />
      )}

      {addMemberOpen && (
        <AddMemberModal
          departmentId={id}
          members={allMembers.filter((m) => !memberIds.has(m.id))}
          onClose={() => setAddMemberOpen(false)}
          onAdded={() => {
            setAddMemberOpen(false);
            void load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTaskId}
        title="Delete task?"
        message="This task will be permanently removed."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => void deleteTask()}
        onClose={() => setDeleteTaskId(null)}
      />
    </div>
  );
}

export default function DepartmentDetailPageRoute() {
  return (
    <RequirePermission permission="department.view">
      <DepartmentDetailPage />
    </RequirePermission>
  );
}

/* ---------------- Task modal ---------------- */

function TaskModal({
  departmentId,
  task,
  members,
  onClose,
  onSaved,
}: {
  departmentId: string;
  task?: Task;
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    assigneeId: task?.assigneeId ?? "",
    status: task?.status ?? "TODO",
    dueDate: task?.dueDate ? task.dueDate.slice(0, 16) : "",
  });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        ...(form.description ? { description: form.description } : {}),
        ...(form.assigneeId ? { assigneeId: form.assigneeId } : {}),
        status: form.status,
        ...(form.dueDate ? { dueDate: new Date(form.dueDate).toISOString() } : {}),
      };
      if (task) {
        await apiPatch(`/api/departments/${departmentId}/tasks/${task.id}`, payload);
        toast.success("Task updated");
      } else {
        await apiPost(`/api/departments/${departmentId}/tasks`, payload);
        toast.success("Task created");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={task ? "Edit Task" : "New Task"}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Title">
          <Input
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Book the rehearsal hall"
          />
        </Field>
        <Field label="Description" optional>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Details, notes, links…"
          />
        </Field>
        <Grid preset="fields">
          <Field label="Assignee" optional>
            <Select
              value={form.assigneeId}
              onChange={(v) => setForm({ ...form, assigneeId: v })}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.user.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {taskStatusLabel(s)}
                </option>
              ))}
            </Select>
          </Field>
        </Grid>
        <Field label="Due date" optional>
          <Input
            type="datetime-local"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </Field>
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" full type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button full type="submit" loading={saving}>
            {task ? "Save Changes" : "Create Task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Add member modal ---------------- */

function AddMemberModal({
  departmentId,
  members,
  onClose,
  onAdded,
}: {
  departmentId: string;
  members: Member[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const toast = useToast();
  const [memberId, setMemberId] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) {
      toast.error("Select a member");
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/api/members/${memberId}/departments`, {
        departmentId,
      });
      toast.success("Member added");
      onAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Add failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add Member to Department">
      <form onSubmit={save} className="space-y-4">
        {members.length === 0 ? (
          <p className="rounded-2xl bg-black/[0.03] p-4 text-[13.5px] text-sub dark:bg-white/5 dark:text-slate-400">
            All members are already in this department.
          </p>
        ) : (
          <Field label="Member">
            <Select value={memberId} onChange={setMemberId} className="max-h-64">
              <option value="">Select member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.user.name} · {m.memberCode}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" full type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button full type="submit" loading={saving} disabled={members.length === 0}>
            Add Member
          </Button>
        </div>
      </form>
    </Modal>
  );
}
