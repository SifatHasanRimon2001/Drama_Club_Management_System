"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { Committee, Member, Role } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";
import { Button, ActionIcon } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Grid } from "@/components/ui/layout";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRealtimeRefresh } from "@/lib/client/socket";

export default function CommitteesPage() {
  const { user } = useSession();
  const canManage = user?.permissions?.includes("committee.manage") ?? false;
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCommittees(await apiGet<Committee[]>("/api/committees?all=true"));
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load committees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Live: refresh committees as roles/members are assigned elsewhere.
  useRealtimeRefresh(["Committee", "Role", "Member", "CommitteeMemberRole"], load);

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
        {canManage && (
          <Button icon="plus" onClick={() => setCreating(true)}>
            New Committee
          </Button>
        )}
      </div>

      {loading ? (
        <PageLoader label="Loading committees…" />
      ) : loadError ? (
        <EmptyState
          icon="warn"
          title="Couldn't load committees"
          message={loadError}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : committees.length === 0 ? (
        <EmptyState
          icon="trophy"
          title="No committees yet"
          message="Create a committee to get started."
        />
      ) : (
        <div className="space-y-4">
          {committees.map((c) => (
            <CommitteeCard
              key={c.id}
              committee={c}
              canManage={canManage}
              onChanged={() => void load()}
            />
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
  canManage,
}: {
  committee: Committee;
  onChanged: () => void;
  canManage: boolean;
}) {
  const toast = useToast();
  const [assigning, setAssigning] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState({ memberId: "", roleId: "" });
  const [saving, setSaving] = useState(false);

  const active = useMemo(
    () => committee.memberRoles.filter((r) => !r.endedAt),
    [committee.memberRoles]
  );

  const openAssign = async () => {
    setLoadingOptions(true);
    try {
      const [r, m] = await Promise.all([
        apiGet<Role[]>("/api/roles"),
        apiGet<{ members: Member[] }>("/api/members?limit=200"),
      ]);
      setRoles(r);
      setMembers(m.members);
      setAssigning(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load options");
    } finally {
      setLoadingOptions(false);
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
        {canManage && (
          <Button
            size="sm"
            icon="plus"
            loading={loadingOptions}
            onClick={() => void openAssign()}
          >
            Assign Role
          </Button>
        )}
      </CardHeader>
      <CardBody>
        {active.length === 0 ? (
          <p className="py-4 text-center text-[13.5px] text-sub dark:text-gray-400">
            No officers assigned to this committee yet.
          </p>
        ) : (
          <Grid preset="list">
            {active.map((mr) => (
              <div
                key={mr.id}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-line px-3.5 py-3 dark:border-white/10"
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
                {canManage && (
                  <ActionIcon
                    icon="close"
                    label="End role"
                    size="xs"
                    className="hover:bg-red/10 hover:text-red dark:hover:bg-red/20 dark:hover:text-red-300"
                    onClick={() => void removeRole(mr.id)}
                  />
                )}
              </div>
            ))}
          </Grid>
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
        <Grid preset="fields">
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
        </Grid>
        <Grid preset="fields">
          <Field label="End date" optional>
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </Field>
          <Field label="Mark as current">
            <Select
              value={form.isCurrent ? "yes" : "no"}
              onChange={(v) => setForm({ ...form, isCurrent: v === "yes" })}
            >
              <option value="yes">Yes — archive previous</option>
              <option value="no">No — archive only</option>
            </Select>
          </Field>
        </Grid>
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
