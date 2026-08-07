"use client";

import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { Permission, Role } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";
import { Button, ActionIcon } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Grid } from "@/components/ui/layout";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRealtimeRefresh } from "@/lib/client/socket";

const PERMISSION_GROUPS: { key: string; label: string; icon: string; tone: string }[] = [
  { key: "member", label: "Member management", icon: "members", tone: "text-blue" },
  { key: "department", label: "Departments & tasks", icon: "folder", tone: "text-teal" },
  { key: "committee", label: "Committee", icon: "trophy", tone: "text-purple" },
  { key: "role", label: "Roles & permissions", icon: "shield", tone: "text-red" },
  { key: "registration", label: "Registration", icon: "megaphone", tone: "text-orange" },
  { key: "applicant", label: "Applicants", icon: "user", tone: "text-pink" },
  { key: "promotion", label: "Promotions", icon: "trend", tone: "text-green" },
  { key: "event", label: "Events", icon: "calendar", tone: "text-blue" },
  { key: "update", label: "Updates", icon: "note", tone: "text-indigo" },
  { key: "gallery", label: "Gallery", icon: "gallery", tone: "text-teal" },
  { key: "settings", label: "Settings", icon: "settings", tone: "text-gray" },
  { key: "audit", label: "Audit log", icon: "list", tone: "text-gray" },
];

export default function RolesPage() {
  const { user } = useSession();
  const canManage = user?.permissions?.includes("permissions.manage") ?? false;
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        apiGet<Role[]>("/api/roles"),
        apiGet<Permission[]>("/api/permissions"),
      ]);
      setRoles(r);
      setPermissions(p);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Live: refresh role/permission changes in real time.
  useRealtimeRefresh(["Role", "Permission", "RolePermission"], load);

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    const group = p.key.split(".")[0];
    (acc[group] ||= []).push(p);
    return acc;
  }, {});

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await apiDelete(`/api/roles/${deleting.id}`);
      toast.success("Role deleted");
      setDeleting(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-ink dark:text-gray-100">
            Roles & Access
          </h1>
          <p className="mt-1 text-[14px] text-sub dark:text-gray-400">
            Define roles and the permissions they grant
          </p>
        </div>
        {canManage && (
          <Button icon="plus" onClick={() => setCreating(true)}>
            New Role
          </Button>
        )}
      </div>

      {loading ? (
        <PageLoader label="Loading roles…" />
      ) : loadError ? (
        <EmptyState
          icon="warn"
          title="Couldn't load roles"
          message={loadError}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : roles.length === 0 ? (
        <EmptyState
          icon="shield"
          title="No roles yet"
          message="Create your first role to define what members can do."
        />
      ) : (
        <Grid preset="cards">
          {roles.map((r) => (
            <Card key={r.id} className="min-w-0">
              <CardHeader className="flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-purple/12 text-purple dark:bg-purple/20 dark:text-purple-300">
                    <Icon name="role" size={16} />
                  </span>
                  <div>
                    <CardTitle>{r.name}</CardTitle>
                    <p className="text-[12px] text-sub dark:text-gray-400">
                      {r.description || "No description"} · {r.permissions.length} permissions
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canManage && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                      <ActionIcon
                        icon="trash"
                        label={`Delete ${r.name}`}
                        size="xs"
                        className="hover:bg-red/10 hover:text-red dark:hover:bg-red/20 dark:hover:text-red-300"
                        onClick={() => setDeleting(r)}
                      />
                    </>
                  )}
                </div>
              </CardHeader>
              <CardBody className="flex flex-wrap gap-1.5">
                {r.permissions.length === 0 ? (
                  <p className="text-[12.5px] text-faint">No permissions assigned.</p>
                ) : (
                  r.permissions.map((rp) => (
                    <span
                      key={rp.permissionId}
                      className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[11.5px] font-medium text-sub dark:bg-white/10 dark:text-gray-300"
                    >
                      {rp.permission.key}
                    </span>
                  ))
                )}
              </CardBody>
            </Card>
          ))}
        </Grid>
      )}

      {(creating || editing) && (
        <RoleModal
          role={editing}
          grouped={grouped}
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
          title="Delete role?"
          message={`"${deleting.name}" will be permanently removed. Roles assigned to committee members or referenced by promotion requests can't be deleted.`}
          confirmLabel="Delete"
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function RoleModal({
  role,
  grouped,
  onClose,
  onSaved,
}: {
  role: Role | null;
  grouped: Record<string, Permission[]>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: role?.name ?? "",
    description: role?.description ?? "",
  });
  const [selected, setSelected] = useState<Set<string>>(
    new Set(role?.permissions.map((rp) => rp.permissionId) ?? [])
  );
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Role name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        ...(form.description ? { description: form.description } : {}),
        permissionIds: Array.from(selected),
      };
      if (role) {
        await apiPatch(`/api/roles/${role.id}`, payload);
        toast.success("Role updated");
      } else {
        await apiPost("/api/roles", payload);
        toast.success("Role created");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={role ? `Edit ${role.name}` : "New Role"} size="lg">
      <form onSubmit={save} className="space-y-4">
        <Grid preset="fields">
          <Field label="Role name">
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Treasurer"
            />
          </Field>
          <Field label="Description" optional>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this role do?"
            />
          </Field>
        </Grid>

        <div>
          <p className="mb-2 text-[13px] font-medium text-sub dark:text-gray-400">
            Permissions{" "}
            <span className="text-faint">({selected.size} selected)</span>
          </p>
          <div className="max-h-[340px] space-y-3 overflow-y-auto rounded-2xl border border-line p-4 dark:border-white/10">
            {Object.entries(grouped).map(([group, perms]) => {
              const meta = PERMISSION_GROUPS.find((g) => g.key === group);
              return (
                <div key={group}>
                  <p className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold text-ink dark:text-gray-200">
                    <Icon
                      name={(meta?.icon as IconName) || "shield"}
                      size={14}
                      className={meta?.tone || "text-faint"}
                    />
                    {meta?.label ?? group}
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {perms.map((p) => {
                      const active = selected.has(p.id);
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition",
                            "focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/20",
                            active
                              ? "border-accent/50 bg-accent-soft/40 dark:bg-accent/15"
                              : "border-line hover:border-line-strong dark:border-white/10"
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[12.5px] font-medium text-ink dark:text-gray-200">
                              {p.key}
                            </span>
                            {p.description && (
                              <span className="block truncate text-[11px] text-faint dark:text-gray-500">
                                {p.description}
                              </span>
                            )}
                          </span>
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={active}
                            onChange={() => toggle(p.id)}
                          />
                          <span
                            aria-hidden="true"
                            className={cn(
                              "relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200",
                              active ? "bg-green" : "bg-black/20 dark:bg-white/25"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute size-[27px] rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.3)] transition-all duration-200",
                                active ? "left-[22px]" : "left-[2px]"
                              )}
                            />
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" full type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button full type="submit" loading={saving}>
            {role ? "Save Changes" : "Create Role"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
