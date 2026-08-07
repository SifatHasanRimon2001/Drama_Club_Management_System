"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { Applicant, FormFieldSpec, Pagination, RegistrationWindow } from "@/lib/types";
import {
  APPLICANT_STATUSES,
  applicantStatusLabel,
  formatDateTime,
  REG_WINDOW_STATUSES,
  windowStatusLabel,
} from "@/lib/format";
import { allowedTransitionsFor } from "@/lib/registration-window-transitions";
import { Icon, type IconName } from "@/components/icons";
import { Button, ActionIcon } from "@/components/ui/button";
import { Field, Input, SearchInput, Select, Textarea } from "@/components/ui/input";
import { Grid, Toolbar } from "@/components/ui/layout";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Modal } from "@/components/ui/modal";
import { Pagination as Pager } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { useRealtimeRefresh } from "@/lib/client/socket";

type Tab = "windows" | "applications";

const FIELD_TYPES: FormFieldSpec["type"][] = ["text", "textarea", "select", "checkbox", "number"];

export default function RegistrationPage() {
  const { user } = useSession();
  const perms = user?.permissions ?? [];
  const canManage = perms.includes("registration.manage");
  const canReview = perms.includes("registration.review");
  const canCreate = perms.includes("member.create");

  const [tab, setTab] = useState<Tab>(canManage ? "windows" : "applications");

  if (!canManage && !canReview) {
    return (
      <EmptyState
        icon="lock"
        title="No access"
        message="You don't have permission to manage registration."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-ink dark:text-gray-100">
            Registration
          </h1>
          <p className="mt-1 text-[14px] text-sub dark:text-gray-400">
            Manage recruitment windows and applications
          </p>
        </div>
      </div>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          ...(canManage ? [{ value: "windows" as Tab, label: "Windows" }] : []),
          ...(canReview ? [{ value: "applications" as Tab, label: "Applications" }] : []),
        ]}
      />

      {tab === "windows" && canManage ? (
        <WindowsTab />
      ) : (
        <ApplicationsTab canCreate={canCreate} />
      )}
    </div>
  );
}

/* ---------------- Windows ---------------- */

function WindowsTab() {
  const toast = useToast();
  const [windows, setWindows] = useState<RegistrationWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RegistrationWindow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ windows: RegistrationWindow[] }>(
        "/api/registration-windows?limit=100"
      );
      setWindows(data.windows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Live: refresh windows when their status/fields change in real time.
  useRealtimeRefresh(["RegistrationWindow"], load);

  const changeStatus = async (w: RegistrationWindow, status: string) => {
    try {
      await apiPatch(`/api/registration-windows/${w.id}`, { status });
      toast.success(`Window ${windowStatusLabel(status)}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status update failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button icon="plus" onClick={() => setCreating(true)}>
          New Window
        </Button>
      </div>

      {loading ? (
        <PageLoader label="Loading windows…" />
      ) : windows.length === 0 ? (
        <EmptyState
          icon="window"
          title="No registration windows"
          message="Create a window to start recruiting new members."
        />
      ) : (
        windows.map((w) => (
          <Card key={w.id}>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{w.title}</CardTitle>
                  <StatusPill value={w.status} />
                </div>
                <p className="mt-1 text-[12.5px] text-sub dark:text-gray-400">
                  {formatDateTime(w.startDate)} → {formatDateTime(w.endDate)} ·{" "}
                  {w._count?.applicants ?? 0} applications
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(w)}>
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              <p className="line-clamp-2 text-[13.5px] text-sub dark:text-gray-400">
                {w.description}
              </p>
              {w.formSchema && Array.isArray(w.formSchema.fields) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(w.formSchema.fields as FormFieldSpec[]).map((f) => (
                    <Badge key={f.name} tone="gray">
                      {f.label || f.name}
                      {f.required ? " *" : ""}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4 dark:border-white/10">
                <StatusTransitions status={w.status} onSelect={(s) => void changeStatus(w, s)} />
              </div>
            </CardBody>
          </Card>
        ))
      )}

      {(creating || editing) && (
        <WindowModal
          window={editing}
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
    </div>
  );
}

function StatusTransitions({
  status,
  onSelect,
}: {
  status: string;
  onSelect: (s: string) => void;
}) {
  const map: Record<string, string[]> = {
    DRAFT: ["SCHEDULED", "LIVE"],
    SCHEDULED: ["LIVE"],
    LIVE: ["CLOSED"],
    CLOSED: ["LIVE"],
  };
  const options = map[status] || [];
  return (
    <>
      {options.map((s) => (
        <Button key={s} size="sm" variant="secondary" onClick={() => onSelect(s)}>
          {s === "LIVE" && status === "CLOSED" ? "Reopen" : `Mark ${windowStatusLabel(s)}`}
        </Button>
      ))}
      {options.length === 0 && <p className="text-[12.5px] text-faint">No further actions.</p>}
    </>
  );
}

/* ---------------- Window create/edit + form builder ---------------- */

function WindowModal({
  window,
  onClose,
  onSaved,
}: {
  window: RegistrationWindow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: window?.title ?? "",
    description: window?.description ?? "",
    bannerUrl: window?.bannerUrl ?? "",
    startDate: window?.startDate ? window.startDate.slice(0, 16) : "",
    endDate: window?.endDate ? window.endDate.slice(0, 16) : "",
    status: window?.status ?? "DRAFT",
  });
  const [fields, setFields] = useState<FormFieldSpec[]>(
    (() => {
      const f = (window?.formSchema as { fields?: FormFieldSpec[] })?.fields;
      return f?.length
        ? f
        : [
            { name: "departmentPrefs", type: "select", label: "Preferred departments", required: true, options: [] },
            { name: "skills", type: "text", label: "Skills", required: false },
          ];
    })()
  );
  const [saving, setSaving] = useState(false);

  const updateField = (i: number, patch: Partial<FormFieldSpec>) => {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { name: `field_${prev.length + 1}`, type: "text", label: "New question", required: false },
    ]);
  };

  const removeField = (i: number) => {
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.startDate || !form.endDate) {
      toast.error("Title, description and dates are required");
      return;
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      toast.error("End date must be after start date");
      return;
    }
    const cleanFields = fields.map((f) => ({
      name: f.name.replace(/\s+/g, "_").toLowerCase() || `field_${Math.random().toString(36).slice(2, 7)}`,
      type: f.type,
      label: f.label || f.name,
      required: f.required,
      options: f.type === "select" ? (f.options ?? []).filter((o) => o.trim()) : undefined,
    }));
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        ...(form.bannerUrl ? { bannerUrl: form.bannerUrl } : {}),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        status: form.status,
        formSchema: { fields: cleanFields },
      };
      if (window) {
        await apiPatch(`/api/registration-windows/${window.id}`, payload);
        toast.success("Window updated");
      } else {
        await apiPost("/api/registration-windows", payload);
        toast.success("Window created");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={window ? "Edit Window" : "New Registration Window"} size="lg">
      <form onSubmit={save} className="space-y-5">
        <Field label="Title">
          <Input
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Spring 2026 Auditions"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What should applicants know?"
          />
        </Field>
        <Field label="Banner URL" optional>
          <Input
            value={form.bannerUrl}
            onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
            placeholder="https://…"
          />
        </Field>
        <Grid preset="fields">
          <Field label="Start">
            <Input
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label="End">
            <Input
              type="datetime-local"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </Field>
        </Grid>
        <Field label="Status">
          <Select value={form.status} onChange={(v) => setForm({ ...form, status: v })}>
            {(window
              ? [form.status, ...allowedTransitionsFor(form.status)].filter(
                  (s, i, arr) => arr.indexOf(s) === i && REG_WINDOW_STATUSES.includes(s as (typeof REG_WINDOW_STATUSES)[number])
                )
              : REG_WINDOW_STATUSES
            ).map((s) => (
              <option key={s} value={s}>
                {windowStatusLabel(s)}
              </option>
            ))}
          </Select>
        </Field>

        {/* Form builder */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-sub dark:text-gray-400">
              Application form fields
            </p>
            <Button type="button" size="sm" variant="secondary" icon="plus" onClick={addField}>
              Add Field
            </Button>
          </div>
          <div className="space-y-3">
            {fields.map((f, i) => (
              <div
                key={i}
                className="rounded-2xl border border-line p-3.5 dark:border-white/10"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
                  <Field label="Question">
                    <Input
                      value={f.label ?? ""}
                      onChange={(e) => updateField(i, { label: e.target.value })}
                      placeholder="Question label"
                    />
                  </Field>
                  <Field label="Field name">
                    <Input
                      value={f.name}
                      onChange={(e) => updateField(i, { name: e.target.value })}
                      placeholder="field_key"
                    />
                  </Field>
                  <Field label="Type">
                    <Select
                      value={f.type}
                      onChange={(v) => updateField(i, { type: v as FormFieldSpec["type"] })}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {f.type === "select" && (
                  <div className="mt-3">
                    <Field label="Options" hint="Comma separated">
                      <Input
                        value={(f.options ?? []).join(", ")}
                        onChange={(e) =>
                          updateField(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })
                        }
                        placeholder="Acting, Directing, Stage, Tech…"
                      />
                    </Field>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <Toggle
                    checked={!!f.required}
                    onChange={(v) => updateField(i, { required: v })}
                    label="Required"
                  />
                  <ActionIcon
                    icon="trash"
                    label="Remove field"
                    size="xs"
                    className="hover:bg-red/10 hover:text-red dark:hover:bg-red/20 dark:hover:text-red-300"
                    onClick={() => removeField(i)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" full type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button full type="submit" loading={saving}>
            {window ? "Save Changes" : "Create Window"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Applications ---------------- */

interface ApplicantRow extends Applicant {
  registrationWindow: { id: string; title: string };
}

function ApplicationsTab({ canCreate }: { canCreate: boolean }) {
  const toast = useToast();
  const [windows, setWindows] = useState<RegistrationWindow[]>([]);
  const [rows, setRows] = useState<ApplicantRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [windowId, setWindowId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<ApplicantRow | null>(null);
  const [converting, setConverting] = useState<ApplicantRow | null>(null);
  const [convertPassword, setConvertPassword] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiGet<{ windows: RegistrationWindow[] }>("/api/registration-windows?limit=100")
      .then((d) => setWindows(d.windows))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (windowId) params.set("windowId", windowId);
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      if (page > 1) params.set("page", String(page));
      const data = await apiGet<{ applicants: ApplicantRow[]; pagination: Pagination }>(
        `/api/applicants?${params.toString()}`
      );
      setRows(data.applicants);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [windowId, status, search, page]);

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Live: refresh the applicant queue as submissions/conversions arrive.
  useRealtimeRefresh(["RegistrationWindow", "Applicant", "Member"], load);

  const decide = async (id: string, decision: string) => {
    try {
      await apiPatch(`/api/applicants/${id}`, { status: decision });
      const label =
        decision === "ACCEPTED"
          ? "Application accepted"
          : decision === "REJECTED"
            ? "Application rejected"
            : "Marked under review";
      toast.success(label);
      void load();
      setViewing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const exportCsv = () => {
    if (!windowId) {
      toast.error("Select a window to export");
      return;
    }
    window.open(`/api/applicants/export?windowId=${windowId}`, "_blank");
  };

  const doConvert = async () => {
    if (!converting) return;
    setBusy(true);
    try {
      const data = await apiPost<{ tempPassword?: string }>(`/api/applicants/${converting.id}/convert`, {
        ...(convertPassword ? { password: convertPassword } : {}),
      });
      setTempPassword(data.tempPassword ?? convertPassword);
      setConvertPassword("");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Conversion failed");
      setConverting(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="min-w-[220px] flex-1">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applicants…"
          />
        </div>
        <Select value={windowId} onChange={(v) => { setWindowId(v); setPage(1); }} className="w-52">
          <option value="">All windows</option>
          {windows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(v) => { setStatus(v); setPage(1); }} className="w-44">
          <option value="">All statuses</option>
          {APPLICANT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {applicantStatusLabel(s)}
            </option>
          ))}
        </Select>
        <Button variant="secondary" icon="download" onClick={exportCsv} disabled={!windowId}>
          Export
        </Button>
      </Toolbar>

      {loading && !rows.length ? (
        <PageLoader label="Loading applications…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="user"
          title="No applications found"
          message="Adjust filters, or wait for applicants to submit."
        />
      ) : (
        <Card>
          <CardBody className="divide-y divide-line px-0 dark:divide-white/10">
            {rows.map((a) => (
              <button
                key={a.id}
                onClick={() => setViewing(a)}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent dark:bg-accent/20 dark:text-blue-300">
                  <Icon name="user" size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-ink dark:text-gray-100">
                    {a.name}
                  </p>
                  <p className="truncate text-[12.5px] text-sub dark:text-gray-400">
                    {a.email} · {a.registrationWindow?.title}
                  </p>
                </div>
                <span className="hidden text-[12px] text-faint sm:block">
                  {a.createdAt ? formatDateTime(a.createdAt) : ""}
                </span>
                <StatusPill value={a.status} />
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
        <ApplicantModal
          applicant={viewing}
          onClose={() => setViewing(null)}
          onDecide={(d) => void decide(viewing.id, d)}
          canCreate={canCreate}
          onConvert={() => {
            setConverting(viewing);
            setViewing(null);
          }}
        />
      )}

      {converting && (
        <Modal
          open
          onClose={() => setConverting(null)}
          title={`Convert ${converting.name}`}
          subtitle="Creates an account and activates them as a member"
        >
          {tempPassword ? (
            <div className="space-y-4">
              <p className="rounded-2xl bg-green/10 p-4 text-[14px] text-ink dark:text-gray-100">
                Member converted! A temporary password was generated:
              </p>
              <div className="rounded-xl border border-dashed border-line-strong p-3 text-center font-mono text-[15px] font-bold text-ink dark:border-white/20 dark:text-gray-100">
                {tempPassword}
              </div>
              <p className="text-[13px] text-sub dark:text-gray-400">
                Share this securely with {converting.name}. They can change it after
                signing in.
              </p>
              <Button full onClick={() => setConverting(null)}>
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Field
                label="Set a password instead"
                hint="Leave blank to generate a temporary password"
              >
                <Input
                  type="password"
                  value={convertPassword}
                  onChange={(e) => setConvertPassword(e.target.value)}
                  placeholder="Optional custom password"
                />
              </Field>
              <div className="flex gap-3">
                <Button variant="ghost" full onClick={() => setConverting(null)}>
                  Cancel
                </Button>
                <Button full loading={busy} onClick={() => void doConvert()}>
                  Convert to Member
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Applicant detail ---------------- */

function ApplicantModal({
  applicant,
  onClose,
  onDecide,
  canCreate,
  onConvert,
}: {
  applicant: ApplicantRow;
  onClose: () => void;
  onDecide: (status: string) => void;
  canCreate: boolean;
  onConvert: () => void;
}) {
  const isActionable = ["SUBMITTED", "UNDER_REVIEW"].includes(applicant.status);
  const canMarkUnderReview = applicant.status === "SUBMITTED";
  const isAccepted = applicant.status === "ACCEPTED";

  const fields: { icon: IconName; label: string; value: React.ReactNode }[] = [
    { icon: "mail", label: "Email", value: applicant.email },
    { icon: "pin", label: "Phone", value: applicant.phone },
    { icon: "tag", label: "Student ID", value: applicant.studentId },
    { icon: "clock", label: "Applied", value: formatDateTime(applicant.createdAt) },
    {
      icon: "flag",
      label: "Portfolio",
      value: applicant.portfolioUrl ? (
        <a href={applicant.portfolioUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          {applicant.portfolioUrl}
        </a>
      ) : "—",
    },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={applicant.name}
      subtitle={applicant.registrationWindow?.title}
      size="lg"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <StatusPill value={applicant.status} />
          {applicant.convertedMember && (
            <Badge tone="green">Member {applicant.convertedMember.memberCode}</Badge>
          )}
        </div>

        <Grid preset="split">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center gap-3 rounded-2xl border border-line px-3.5 py-3 dark:border-white/10">
              <Icon name={f.icon} size={15} className="shrink-0 text-faint" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-faint">{f.label}</p>
                <p className="truncate text-[13.5px] font-medium text-ink dark:text-gray-100">{f.value}</p>
              </div>
            </div>
          ))}
        </Grid>

        <div className="rounded-2xl border border-line p-4 dark:border-white/10">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
            Preferred departments
          </p>
          <div className="flex flex-wrap gap-1.5">
            {applicant.departmentPrefs.length ? (
              applicant.departmentPrefs.map((d) => (
                <Badge key={d} tone="blue">
                  {d}
                </Badge>
              ))
            ) : (
              <p className="text-[13px] text-sub dark:text-gray-400">—</p>
            )}
          </div>
        </div>

        {applicant.skills?.length > 0 && (
          <div className="rounded-2xl border border-line p-4 dark:border-white/10">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
              Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {applicant.skills.map((s) => (
                <Badge key={s} tone="gray">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {applicant.actingExperience && (
          <div className="rounded-2xl border border-line p-4 dark:border-white/10">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
              Acting experience
            </p>
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink dark:text-gray-200">
              {applicant.actingExperience}
            </p>
          </div>
        )}

        {applicant.customResponses && Object.keys(applicant.customResponses).length > 0 && (
          <div className="space-y-3">
            {Object.entries(applicant.customResponses).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-line p-4 dark:border-white/10">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                  {key.replace(/_/g, " ")}
                </p>
                <p className="text-[13.5px] leading-relaxed text-ink dark:text-gray-200">
                  {Array.isArray(value) ? value.join(", ") : String(value ?? "—")}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4 dark:border-white/10">
          {isActionable && (
            <>
              {canMarkUnderReview && (
                <Button variant="secondary" onClick={() => onDecide("UNDER_REVIEW")}>
                  Under review
                </Button>
              )}
              <Button variant="danger" onClick={() => onDecide("REJECTED")}>
                Reject
              </Button>
              <Button onClick={() => onDecide("ACCEPTED")}>Accept</Button>
            </>
          )}
          {isAccepted && canCreate && !applicant.convertedMember && (
            <Button icon="user" onClick={onConvert}>
              Convert to Member
            </Button>
          )}
          {applicant.convertedMember && (
            <p className="text-[13px] text-sub dark:text-gray-400">
              Converted to member {applicant.convertedMember.memberCode}.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
