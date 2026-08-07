"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet, apiPatch } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { Member } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { Grid } from "@/components/ui/layout";
import { useRealtimeRefresh } from "@/lib/client/socket";

interface ProfileMember extends Omit<Member, "departments" | "committeeRoles"> {
  user: { id: string; name: string; email: string; image: string | null };
  departments: { departmentId: string; department: { id: string; name: string } }[];
  committeeRoles: {
    id: string;
    startedAt: string;
    endedAt: string | null;
    role: { id: string; name: string };
    committee: { id: string; year: string; isCurrent: boolean; startDate: string; endDate: string | null };
  }[];
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.04] text-faint dark:bg-white/10 dark:text-gray-500">
        <Icon name={icon as "user"} size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-medium uppercase tracking-wide text-faint dark:text-gray-500">
          {label}
        </p>
        <p className="mt-0.5 text-[14px] font-medium text-ink dark:text-gray-100">{children}</p>
      </div>
    </div>
  );
}

export default function MemberProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useSession();
  const canEdit = user?.permissions?.includes("member.edit") ?? false;

  const [member, setMember] = useState<ProfileMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(null);
    try {
      const data = await apiGet<ProfileMember>(`/api/members/${id}`);
      setMember(data);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Unable to load this member.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Live: keep the profile in sync with role/department/status changes.
  useRealtimeRefresh(
    ["Member", "CommitteeMemberRole", "MemberDepartment", "Role"],
    load
  );

  if (loading && !member) return <PageLoader label="Loading profile…" />;

  if (failed || !member) {
    return (
      <EmptyState
        icon="user"
        title="Profile unavailable"
        message={failed ?? "This member could not be found."}
      />
    );
  }

  const photo = member.photoUrl || member.user.image;
  const activeRoles = member.committeeRoles.filter(
    (r) => r.committee.isCurrent && !r.endedAt
  );
  const pastRoles = member.committeeRoles.filter(
    (r) => !r.committee.isCurrent || r.endedAt
  );

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/members"
        className="inline-flex items-center gap-1 text-[13.5px] font-medium text-sub transition hover:text-ink dark:text-gray-400 dark:hover:text-gray-200"
      >
        <Icon name="chevron-left" size={15} /> Members
      </Link>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-5">
            <Avatar name={member.user.name} src={photo} size={76} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[24px] font-bold tracking-tight text-ink dark:text-gray-100">
                  {member.user.name}
                </h1>
                <StatusPill value={member.status} />
                {activeRoles.length > 0 && (
                  <span className="rounded-full bg-purple/12 px-2.5 py-1 text-[11.5px] font-semibold text-purple dark:bg-purple/20 dark:text-purple-300">
                    {activeRoles.map((r) => r.role.name).join(" · ")}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[14px] text-sub dark:text-gray-400">{member.user.email}</p>
              <p className="mt-1 text-[12.5px] text-faint dark:text-gray-500">
                {member.memberCode} · Joined {formatDate(member.joiningDate)}
              </p>
            </div>
            {canEdit && (
              <Button icon="edit" variant="secondary" onClick={() => setEditing(true)}>
                Edit Details
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      <Grid preset="split">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
          </CardHeader>
          <CardBody className="pt-4">
            <div className="divide-y divide-line dark:divide-white/10">
              <DetailRow icon="mail" label="Email">
                {member.user.email}
              </DetailRow>
              <DetailRow icon="phone" label="Phone">
                {member.phone || "—"}
              </DetailRow>
              <DetailRow icon="pin" label="Address">
                {member.address || "—"}
              </DetailRow>
              <DetailRow icon="calendar" label="Date of birth">
                {member.dateOfBirth ? formatDate(member.dateOfBirth) : "—"}
              </DetailRow>
              <DetailRow icon="phone" label="Emergency contact">
                {member.emergencyContact || "—"}
              </DetailRow>
            </div>
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Departments</CardTitle>
            </CardHeader>
            <CardBody className="pt-4">
              {member.departments.length === 0 ? (
                <p className="text-[13.5px] text-faint">Not assigned to any department yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {member.departments.map((d) => (
                    <Link
                      key={d.departmentId}
                      href={`/dashboard/departments/${d.department.id}`}
                      className="rounded-full bg-black/[0.05] px-3 py-1.5 text-[13px] font-medium text-ink transition hover:bg-black/[0.08] dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/15"
                    >
                      {d.department.name}
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Committee history</CardTitle>
            </CardHeader>
            <CardBody className="pt-4">
              {member.committeeRoles.length === 0 ? (
                <p className="text-[13.5px] text-faint">No committee roles recorded.</p>
              ) : (
                <div className="space-y-5">
                  <CommitteeSection title="Current committee" roles={activeRoles} />
                  {pastRoles.length > 0 && (
                    <CommitteeSection title="Past committees" roles={pastRoles} />
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </Grid>

      {editing && (
        <EditProfileModal
          member={member}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CommitteeSection({
  title,
  roles,
}: {
  title: string;
  roles: ProfileMember["committeeRoles"];
}) {
  if (roles.length === 0) return null;
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-faint dark:text-gray-500">
        {title}
      </p>
      <div className="mt-2 space-y-2">
        {roles.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-black/[0.03] px-3.5 py-2.5 dark:bg-white/5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-purple/12 text-purple dark:bg-purple/20 dark:text-purple-300">
                <Icon name="role" size={14} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-ink dark:text-gray-100">
                  {r.role.name}
                </p>
                <p className="text-[12px] text-sub dark:text-gray-400">{r.committee.year}</p>
              </div>
            </div>
            <span className="text-[12px] text-faint">
              {formatDate(r.startedAt)}
              {r.endedAt ? ` – ${formatDate(r.endedAt)}` : " – present"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditProfileModal({
  member,
  onClose,
  onSaved,
}: {
  member: ProfileMember;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    phone: member.phone ?? "",
    address: member.address ?? "",
    dateOfBirth: member.dateOfBirth ? member.dateOfBirth.slice(0, 10) : "",
    emergencyContact: member.emergencyContact ?? "",
    photoUrl: member.photoUrl ?? "",
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
        ...(form.emergencyContact ? { emergencyContact: form.emergencyContact } : {}),
        ...(form.photoUrl ? { photoUrl: form.photoUrl } : {}),
      });
      toast.success("Profile updated");
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
          <Avatar name={member.user.name} src={member.photoUrl || member.user.image} size={40} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink dark:text-gray-100">
              {member.user.name}
            </p>
            <p className="truncate text-[12px] text-sub dark:text-gray-400">
              {member.memberCode} · {member.user.email}
            </p>
          </div>
        </div>
        <Grid preset="fields">
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
            />
          </Field>
          <Field label="Date of birth">
            <Input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            />
          </Field>
        </Grid>
        <Field label="Address">
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Campus address"
          />
        </Field>
        <Field label="Emergency contact">
          <Input
            value={form.emergencyContact}
            onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
            placeholder="Name and phone"
          />
        </Field>
        <Field label="Photo URL" optional>
          <Input
            value={form.photoUrl}
            onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
            placeholder="https://…"
          />
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
