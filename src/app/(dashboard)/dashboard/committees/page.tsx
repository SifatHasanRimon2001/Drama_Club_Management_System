"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost } from "@/lib/client/api";
import type { Committee, Member, Role } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export default function CommitteesPage() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCommittees(await apiGet<Committee[]>("/api/committees?all=true"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-ink dark:text-gray-100">
            Committees
          </h1>
          <p className="mt-1 text-[14px] text-sub dark:text-gray-400">
            Executive committees by year
          </p>
        </div>
        <Button icon="plus" onClick={() => setCreating(true)}>
          New Committee
        </Button>
      </div>

      {loading ? (
        <PageLoader label="Loading committees…" />
      ) : committees.length === 0 ? (
        <EmptyState
          icon="trophy"
          title="No committees yet"
          message="Create a committee to get started."
        />
      ) : (
        <div className="space-y-4">
          {committees.map((c) => (
            <CommitteeCard key={c.id} committee={c} onChanged={() => void load()} />
          ))}
        </div>
      )}

      {creating && (
        <CreateCommitteeModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Committee card ---------------- */

function CommitteeCard({
  committee,
  onChanged,
}: {
  committee: Committee;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [assigning, setAssigning] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState({ memberId: "", roleId: "" });
  const [saving, setSaving] = useState(false);

  const active = useMemo(
    () => committee.memberRoles.filter((r) => !r.endedAt),
    [committee.memberRoles]
  );

  const openAssign = async () => {
    setAssigning(true);
    try {
      const [r, m] = await Promise.all([
        apiGet<Role[]>("/api/roles"),
        apiGet<{ members: Member[] }>("/api/members?limit=200"),
      ]);
      setRoles(r);
      setMembers(m.members);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load options");
    }
  };

  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.memberId || !form.roleId) {
      toast.error("Select a member and a role");
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/api/committees/${committee.id}/roles`, form);
      toast.success("Role assigned");
      setAssigning(false);
      setForm({ memberId: "", roleId: "" });
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async (memberRoleId: string) => {
    try {
      await apiDelete(`/api/committees/${committee.id}/roles?memberRoleId=${memberRoleId}`);
      toast.success("Role ended");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-xl",
              committee.isCurrent
                ? "bg-accent text-white"
                : "bg-black/[0.05] text-sub dark:bg-white/10 dark:text-gray-400"
            )}
          >
            <Icon name="trophy" size={18} />
          </span>
          <div>
            <CardTitle>
              {committee.year} Committee
              {committee.isCurrent && (
                <span className="ml-2 rounded-full bg-green/12 px-2 py-0.5 text-[10.5px] font-semibold text-green dark:bg-green/20 dark:text-green-300">
                  Current
                </span>
              )}
            </CardTitle>
            <p className="text-[12.5px] text-sub dark:text-gray-400">
              {formatDate(committee.startDate)}
              {committee.endDate ? ` → ${formatDate(committee.endDate)}` : ""} ·{" "}
              {active.length} officers · {committee.departments.length} departments
            </p>
          </div>
        </div>
        <Button size="sm" icon="plus" onClick={() => void openAssign()}>
          Assign Role
        </Button>
      </CardHeader>
      <CardBody>
        {active.length === 0 ? (
          <p className="py-4 text-center text-[13.5px] text-sub dark:text-gray-400">
            No officers assigned to this committee yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((mr) => (
              <div
                key={mr.id}
                className="flex items-center gap-3 rounded-2xl border border-line px-3.5 py-3 dark:border-white/10"
              >
                <Avatar name={mr.member.user.name} src={mr.member.user.image} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-ink dark:text-gray-100">
                    {mr.member.user.name}
                  </p>
                  <p className="truncate text-[12px] font-medium text-accent">
                    {mr.role.name}
                  </p>
                </div>
                <button
                  onClick={() => void removeRole(mr.id)}
                  className="flex size-7 items-center justify-center rounded-full text-faint transition hover:bg-red/10 hover:text-red"
                  aria-label="End role"
                >
                  <Icon name="close" size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {assigning && (
          <form
            onSubmit={assign}
            className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-accent-soft/40 p-4 dark:bg-accent/10"
          >
            <div className="min-w-[200px] flex-1">
              <Field label="Member">
                <Select value={form.memberId} onChange={(v) => setForm({ ...form, memberId: v })}>
                  <option value="">Select member…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.user.name} · {m.memberCode}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="min-w-[180px] flex-1">
              <Field label="Role">
                <Select value={form.roleId} onChange={(v) => setForm({ ...form, roleId: v })}>
                  <option value="">Select role…</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAssigning(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={saving}>
                Assign
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

/* ---------------- Create committee modal ---------------- */

function CreateCommitteeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    year: String(new Date().getFullYear()),
    startDate: `${new Date().getFullYear()}-09-01`,
    endDate: "",
    isCurrent: true,
  });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.year.trim() || !form.startDate) {
      toast.error("Year and start date are required");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/committees", {
        year: form.year.trim(),
        startDate: new Date(form.startDate).toISOString(),
        ...(form.endDate ? { endDate: new Date(form.endDate).toISOString() } : {}),
        isCurrent: form.isCurrent,
      });
      toast.success("Committee created");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New Committee">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Year">
            <Input
              autoFocus
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              placeholder="2026"
            />
          </Field>
          <Field label="Start date">
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="End date" optional>
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </Field>
          <Field label="Mark as current">
            <select
              value={form.isCurrent ? "yes" : "no"}
              onChange={(e) => setForm({ ...form, isCurrent: e.target.value === "yes" })}
              className="w-full appearance-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15 dark:border-white/15 dark:bg-[#1c1c1e] dark:text-gray-100"
            >
              <option value="yes">Yes — archive previous</option>
              <option value="no">No — archive only</option>
            </select>
          </Field>
        </div>
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" full type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button full type="submit" loading={saving}>
            Create Committee
          </Button>
        </div>
      </form>
    </Modal>
  );
}
