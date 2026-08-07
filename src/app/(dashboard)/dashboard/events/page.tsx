"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/client/api";
import type { Department, Event, Pagination } from "@/lib/types";
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  EVENT_TYPE_ICONS,
  EVENT_TYPE_TONES,
  eventStatusLabel,
  eventTypeLabel,
  formatDateTime,
} from "@/lib/format";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Modal } from "@/components/ui/modal";
import { Pagination as Pager } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

type Filter = "all" | "upcoming" | Event["type"];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["UPCOMING", "CANCELLED"],
  UPCOMING: ["ONGOING", "CANCELLED"],
  ONGOING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const TONE_CLASSES: Record<string, string> = {
  blue: "bg-blue/12 text-blue dark:bg-blue/20 dark:text-blue-300",
  teal: "bg-teal/12 text-teal dark:bg-teal/20 dark:text-teal-300",
  purple: "bg-purple/12 text-purple dark:bg-purple/20 dark:text-purple-300",
  pink: "bg-pink/12 text-pink dark:bg-pink/20 dark:text-pink-300",
  orange: "bg-orange/12 text-orange dark:bg-orange/20 dark:text-orange-300",
  indigo: "bg-indigo/12 text-indigo dark:bg-indigo/20 dark:text-indigo-300",
};

export default function EventsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Event[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === "upcoming") params.set("upcoming", "true");
      else if (filter !== "all") params.set("type", filter);
      if (page > 1) params.set("page", String(page));
      params.set("includeDrafts", "1");
      const data = await apiGet<{ events: Event[]; pagination: Pagination }>(
        `/api/events?${params.toString()}`
      );
      setRows(data.events);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const transition = async (ev: Event, status: string) => {
    try {
      await apiPatch(`/api/events/${ev.id}`, { status });
      toast.success(`Event marked ${eventStatusLabel(status)}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-ink dark:text-gray-100">
            Events
          </h1>
          <p className="mt-1 text-[14px] text-sub dark:text-gray-400">
            {pagination ? `${pagination.total} events` : "Club calendar"}
          </p>
        </div>
        <Button icon="calendar" onClick={() => setCreating(true)}>
          New Event
        </Button>
      </div>

      <Segmented<Filter>
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
        options={[
          { value: "upcoming", label: "Upcoming" },
          { value: "all", label: "All" },
          ...EVENT_TYPES.map((t) => ({ value: t as Filter, label: eventTypeLabel(t) })),
        ]}
      />

      {loading && !rows.length ? (
        <PageLoader label="Loading events…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No events found"
          message="Try a different filter, or create a new event."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((ev) => (
            <div
              key={ev.id}
              className="flex items-center gap-4 rounded-2xl border border-line bg-white px-4 py-3.5 transition hover:border-accent/30 dark:border-white/10 dark:bg-[#1c1c1e]"
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  TONE_CLASSES[EVENT_TYPE_TONES[ev.type]] || TONE_CLASSES.blue
                )}
              >
                <Icon name={(EVENT_TYPE_ICONS[ev.type] as IconName) || "calendar"} size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold text-ink dark:text-gray-100">
                  {ev.title}
                </p>
                <p className="truncate text-[12.5px] text-sub dark:text-gray-400">
                  {formatDateTime(ev.startAt)}
                  {ev.endAt ? ` → ${formatDateTime(ev.endAt)}` : ""}
                  {ev.location ? ` · ${ev.location}` : ""}
                  {ev.department ? ` · ${ev.department.name}` : ""}
                </p>
              </div>
              <span className="hidden rounded-full bg-black/[0.05] px-2.5 py-1 text-[11.5px] font-medium text-sub sm:block dark:bg-white/10 dark:text-gray-300">
                {eventTypeLabel(ev.type)}
              </span>
              <StatusPill value={ev.status} />
              <div className="flex items-center gap-1">
                {(ALLOWED_TRANSITIONS[ev.status] || []).map((s) => (
                  <Button key={s} size="xs" variant="secondary" onClick={() => void transition(ev, s)}>
                    {eventStatusLabel(s)}
                  </Button>
                ))}
                <button
                  onClick={() => setEditing(ev)}
                  className="flex size-8 items-center justify-center rounded-full text-faint transition hover:bg-black/[0.05] hover:text-ink dark:hover:bg-white/10 dark:hover:text-gray-200"
                  aria-label="Edit event"
                >
                  <Icon name="edit" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
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

      {(creating || editing) && (
        <EventModal
          event={editing}
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

/* ---------------- Create / edit ---------------- */

function EventModal({
  event,
  onClose,
  onSaved,
}: {
  event: Event | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({
    title: event?.title ?? "",
    type: event?.type ?? "PERFORMANCE",
    departmentId: event?.departmentId ?? "",
    startAt: event?.startAt ? event.startAt.slice(0, 16) : "",
    endAt: event?.endAt ? event.endAt.slice(0, 16) : "",
    location: event?.location ?? "",
    description: event?.description ?? "",
    status: event?.status ?? "UPCOMING",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiGet<Department[]>("/api/departments")
      .then(setDepartments)
      .catch(() => {});
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.startAt) {
      toast.error("Title and start time are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        ...(form.departmentId ? { departmentId: form.departmentId } : {}),
        startAt: new Date(form.startAt).toISOString(),
        ...(form.endAt ? { endAt: new Date(form.endAt).toISOString() } : {}),
        ...(form.location ? { location: form.location } : {}),
        ...(form.description ? { description: form.description } : {}),
        status: form.status,
      };
      if (event) {
        await apiPatch(`/api/events/${event.id}`, payload);
        toast.success("Event updated");
      } else {
        await apiPost("/api/events", payload);
        toast.success("Event created");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={event ? "Edit Event" : "New Event"} size="lg">
      <form onSubmit={save} className="space-y-4">
        <Field label="Title">
          <Input
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Spring Festival: The Tempest"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select value={form.type} onChange={(v) => setForm({ ...form, type: v })}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {eventTypeLabel(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department" optional>
            <Select
              value={form.departmentId}
              onChange={(v) => setForm({ ...form, departmentId: v })}
            >
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts">
            <Input
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            />
          </Field>
          <Field label="Ends" optional>
            <Input
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => setForm({ ...form, endAt: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location" optional>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Main Stage, Room 201…"
            />
          </Field>
          {event && (
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
              >
                {EVENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {eventStatusLabel(s)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <Field label="Description" optional>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Details for members and the public…"
          />
        </Field>
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" full type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button full type="submit" loading={saving}>
            {event ? "Save Changes" : "Create Event"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
