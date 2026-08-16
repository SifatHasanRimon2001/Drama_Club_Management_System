"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/client/api";
import type { ClubUpdate, Pagination } from "@/lib/types";
import { UPDATE_CATEGORIES, updateCategoryLabel, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";
import { Button, ActionIcon } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination as Pager } from "@/components/ui/pagination";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRealtimeRefresh } from "@/lib/client/socket";
import { RequirePermission } from "@/components/require-permission";

const CATEGORY_TONES: Record<string, string> = {
  ANNOUNCEMENT: "bg-blue/12 text-blue dark:bg-blue/20 ",
  NOTICE: "bg-orange/12 text-orange dark:bg-orange/20 dark:text-orange-300",
  ACHIEVEMENT: "bg-green/12 text-green dark:bg-green/20 dark:text-green-300",
  PRODUCTION: "bg-purple/12 text-purple dark:bg-purple/20 dark:text-purple-300",
  RECRUITMENT: "bg-pink/12 text-pink dark:bg-pink/20 dark:text-pink-300",
  EVENT: "bg-teal/12 text-teal dark:bg-teal/20 dark:text-teal-300",
};

function UpdatesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ClubUpdate[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ClubUpdate | null>(null);
  const [deleting, setDeleting] = useState<ClubUpdate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (page > 1) params.set("page", String(page));
      const data = await apiGet<{ updates: ClubUpdate[]; pagination: Pagination }>(
        `/api/updates?${params.toString()}`
      );
      setRows(data.updates);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Live: refresh published updates in real time.
  useRealtimeRefresh(["ClubUpdate"], load);

  const remove = async () => {
    if (!deleting) return;
    try {
      await apiDelete(`/api/updates/${deleting.id}`);
      toast.success("Update deleted");
      setDeleting(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="megaphone"
        title="Updates"
        subtitle="Announcements and news for members and the public"
        actions={
          <Button icon="megaphone" onClick={() => setCreating(true)}>
            New Update
          </Button>
        }
      />

      {loading && !rows.length ? (
        <PageLoader label="Loading updates…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="note"
          title="No updates yet"
          message="Publish your first update to keep everyone informed."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((u) => (
            <Card key={u.id}>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        CATEGORY_TONES[u.category] || CATEGORY_TONES.ANNOUNCEMENT
                      )}
                    >
                      {updateCategoryLabel(u.category)}
                    </span>
                    <CardTitle className="!text-[15.5px]">{u.title}</CardTitle>
                  </div>
                  <p className="mt-1 text-[12px] text-faint">
                    {u.publishedAt ? formatDateTime(u.publishedAt) : "Draft"} ·{" "}
                    {u.author?.name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <ActionIcon icon="edit" label="Edit update" size="xs" onClick={() => setEditing(u)} />
                  <ActionIcon
                    icon="trash"
                    label="Delete update"
                    size="xs"
                    className="hover:bg-red/10 hover:text-red dark:hover:bg-red/20 dark:hover:text-red-300"
                    onClick={() => setDeleting(u)}
                  />
                </div>
              </CardHeader>
              <CardBody>
                <div
                  className="rich-text line-clamp-3 text-[13.5px] text-sub"
                  dangerouslySetInnerHTML={{ __html: u.bodyRichText }}
                />
                {u.mediaUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {u.mediaUrls.map((m, i) => (
                      <Badge key={i} tone="gray">
                        <Icon name="image" size={12} /> Media {i + 1}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
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
        <UpdateModal
          update={editing}
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

      <ConfirmDialog
        open={!!deleting}
        title="Delete update?"
        message={`"${deleting?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => void remove()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

export default function UpdatesPageRoute() {
  return (
    <RequirePermission permission="updates.publish">
      <UpdatesPage />
    </RequirePermission>
  );
}

/* ---------------- Editor ---------------- */

function ToolbarButton({
  icon,
  active,
  onClick,
  label,
}: {
  icon: IconName;
  active?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-lg transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        active
          ? "bg-gradient-to-br from-gold-light via-gold to-[#1e40af] text-white dark:bg-accent dark:bg-none dark:text-on-accent"
          : "text-sub hover:bg-black/[0.05] hover:text-ink dark:hover:bg-white/10 dark:hover:text-slate-100"
      )}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose max-w-none min-h-[200px] px-4 py-3 text-[15px] text-ink focus:outline-none rich-text",
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-apple border border-line bg-card shadow-card dark:border-white/10 dark:bg-card">
      <div
        role="toolbar"
        aria-label="Formatting tools"
        className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5 dark:border-white/10"
      >
        <ToolbarButton icon="bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold" />
        <ToolbarButton icon="italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic" />
        <ToolbarButton icon="underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} label="Underline" />
        <span className="mx-1 h-5 w-px bg-line dark:bg-white/10" aria-hidden="true" />
        <ToolbarButton icon="list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Bullet list" />
        <ToolbarButton icon="list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered list" />
        <span className="mx-1 h-5 w-px bg-line dark:bg-white/10" aria-hidden="true" />
        <ToolbarButton icon="quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="Quote" />
        <ToolbarButton icon="code" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} label="Code block" />
        <span className="mx-1 h-5 w-px bg-line dark:bg-white/10" aria-hidden="true" />
        <ToolbarButton icon="align-left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} label="Align left" />
        <ToolbarButton icon="align-center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} label="Align center" />
        <ToolbarButton icon="align-right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} label="Align right" />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

/* ---------------- Modal ---------------- */

function UpdateModal({
  update,
  onClose,
  onSaved,
}: {
  update: ClubUpdate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: update?.title ?? "",
    category: update?.category ?? "ANNOUNCEMENT",
    body: update?.bodyRichText ?? "",
    mediaUrls: update?.mediaUrls.join(", ") ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        bodyRichText: form.body,
        mediaUrls: form.mediaUrls
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean),
      };
      if (update) {
        await apiPatch(`/api/updates/${update.id}`, payload);
        toast.success("Update saved");
      } else {
        await apiPost("/api/updates", payload);
        toast.success("Update published");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={update ? "Edit Update" : "New Update"} size="lg">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <Field label="Title">
            <Input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. New members announced"
            />
          </Field>
          <Field label="Category">
            <Select
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
            >
              {UPDATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {updateCategoryLabel(c)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Content">
          <RichEditor value={form.body} onChange={(html) => setForm({ ...form, body: html })} />
        </Field>
        <Field label="Media URLs" optional hint="Comma-separated image URLs">
          <Input
            value={form.mediaUrls}
            onChange={(e) => setForm({ ...form, mediaUrls: e.target.value })}
            placeholder="https://…, https://…"
          />
        </Field>
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" full type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button full type="submit" loading={saving}>
            {update ? "Save Changes" : "Publish Update"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
