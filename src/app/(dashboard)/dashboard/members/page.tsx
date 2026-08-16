"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPatch } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { Member, Pagination } from "@/lib/types";
import { formatDate, membershipStatusLabel, MEMBER_STATUSES } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input, SearchInput, Select } from "@/components/ui/input";
import { Toolbar } from "@/components/ui/layout";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Dropdown } from "@/components/ui/dropdown";
import { Pagination as Pager } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { useRealtimeRefresh } from "@/lib/client/socket";
import { RequirePermission } from "@/components/require-permission";

interface MemberRow extends Omit<Member, "departments" | "committeeRoles"> {
  departments: { departmentId: string; department: { id: string; name: string } }[];
  committeeRoles: {
    role: { id: string; name: string };
    committee: { id: string; year: string };
  }[];
}

function MembersPage() {
  const { user } = useSession();
  const toast = useToast();
  const canCreate = user?.permissions?.includes("member.create") ?? false;
  const canEdit = user?.permissions?.includes("member.edit") ?? false;

  const [rows, setRows] = useState<MemberRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<MemberRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (page > 1) params.set("page", String(page));
      const data = await apiGet<{ members: MemberRow[]; pagination: Pagination }>(
        `/api/members?${params.toString()}`
      );
      setRows(data.members);
      setPagination(data.pagination);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search, status, page]);

  // Live: reflect other editors' changes to members/roles immediately.
  useRealtimeRefresh(["Member", "User", "CommitteeMemberRole", "MemberDepartment"], load);

  const updateStatus = async (m: MemberRow, newStatus: string) => {
    try {
      await apiPatch(`/api/members/${m.id}`, { status: newStatus });
      toast.success("Status updated");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="members"
        title="Members"
        subtitle={pagination ? `${pagination.total} members in the club` : "Club directory"}
        actions={
          canCreate && (
            <Link
              href="/dashboard/members/new"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-br from-gold-light via-gold to-[#1e40af] px-5 text-sm font-bold text-white shadow-gold transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Icon name="plus" size={16} />
              Add Member
            </Link>
          )
        }
      />

      <Toolbar>
        <div className="min-w-[220px] flex-1">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or member code…"
          />
        </div>
        <Select value={status} onChange={setStatus} className="w-44">
          <option value="">All statuses</option>
          {MEMBER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {membershipStatusLabel(s)}
            </option>
          ))}
        </Select>
      </Toolbar>

      {loading && !rows.length ? (
        <PageLoader label="Loading members…" />
      ) : loadError ? (
        <EmptyState
          icon="warn"
          title="Couldn't load members"
          message={loadError}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="members"
          title="No members found"
          message="Try adjusting your search or filter."
        />
      ) : (
        <Card>
          <CardBody className="divide-y divide-line px-0 dark:divide-white/10">
            {rows.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              >
                <Avatar name={m.user.name} src={m.user.image} size={40} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/members/${m.id}`}
                    className="truncate text-[14.5px] font-semibold text-ink transition hover:text-accent dark:hover:text-accent"
                  >
                    {m.user.name}
                  </Link>
                  <p className="truncate text-[12.5px] text-sub">
                    {m.memberCode} · {m.user.email}
                  </p>
                </div>
                <div className="hidden items-center gap-1.5 md:flex">
                  {m.departments.slice(0, 3).map((d) => (
                    <span
                      key={d.departmentId}
                      className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[11.5px] font-medium text-sub dark:bg-white/10"
                    >
                      {d.department.name}
                    </span>
                  ))}
                </div>
                {m.committeeRoles.length > 0 && (
                  <span className="hidden rounded-full bg-purple/12 px-2.5 py-1 text-[11.5px] font-semibold text-purple lg:block dark:bg-purple/20 dark:text-purple-300">
                    {m.committeeRoles[0].role.name}
                  </span>
                )}
                <span className="hidden w-24 text-[12px] text-faint sm:block">
                  Joined {formatDate(m.joiningDate)}
                </span>
                <StatusPill value={m.status} />
                {canEdit ? (
                  <Dropdown
                    width="w-48"
                    trigger={(open, toggle) => (
                      <button
                        onClick={toggle}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full transition",
                          open
                            ? "bg-black/[0.07] dark:bg-white/15"
                            : "text-faint hover:bg-black/[0.05] hover:text-ink dark:hover:bg-white/10 dark:hover:text-slate-200"
                        )}
                        aria-label="Member actions"
                      >
                        <Icon name="dots" size={17} />
                      </button>
                    )}
                  >
                    {(close) => (
                      <div className="p-1.5">
                        <button
                          onClick={() => {
                            setEditing(m);
                            close();
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium text-ink transition hover:bg-black/[0.05] dark:hover:bg-white/10"
                        >
                          <Icon name="edit" size={15} /> Edit details
                        </button>
                        {MEMBER_STATUSES.filter((s) => s !== m.status).map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              void updateStatus(m, s);
                              close();
                            }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium text-ink transition hover:bg-black/[0.05] dark:hover:bg-white/10"
                          >
                            <Icon name="flag" size={15} /> Mark {membershipStatusLabel(s)}
                          </button>
                        ))}
                      </div>
                    )}
                  </Dropdown>
                ) : (
                  <span className="w-8" />
                )}
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

      {editing && (
        <EditMemberModal
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

export default function MembersPageRoute() {
  return (
    <RequirePermission permission="member.view">
      <MembersPage />
    </RequirePermission>
  );
}

function EditMemberModal({
  member,
  onClose,
  onSaved,
}: {
  member: MemberRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    phone: member.phone ?? "",
    address: member.address ?? "",
    dateOfBirth: member.dateOfBirth ? member.dateOfBirth.slice(0, 10) : "",
    status: member.status,
  });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPatch(`/api/members/${member.id}`, {
        ...(form.phone ? { phone: form.phone } : {}),
        ...(form.address ? { address: form.address } : {}),
        ...(form.dateOfBirth ? { dateOfBirth: new Date(form.dateOfBirth).toISOString() } : {}),
        status: form.status,
      });
      toast.success("Member updated");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit ${member.user.name}`}>
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-black/[0.03] p-3 dark:bg-white/5">
          <Avatar name={member.user.name} src={member.user.image} size={40} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">
              {member.user.name}
            </p>
            <p className="truncate text-[12px] text-sub">
              {member.memberCode} · {member.user.email}
            </p>
          </div>
        </div>
        <Field label="Phone">
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+1 (555) 000-0000"
          />
        </Field>
        <Field label="Address">
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Campus address"
          />
        </Field>
        <Field label="Date of birth">
          <Input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
          />
        </Field>
        <Field label="Status">
          <Select
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v })}
          >
            {MEMBER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {membershipStatusLabel(s)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" full onClick={onClose} type="button">
            Cancel
          </Button>
          <Button full type="submit" loading={saving}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
