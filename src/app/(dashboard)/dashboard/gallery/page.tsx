"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { Department, GalleryAlbum, GalleryItem } from "@/lib/types";
import { ALBUM_CATEGORIES, albumCategoryLabel, timeAgo } from "@/lib/format";
import { r2Url } from "@/lib/server";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Grid } from "@/components/ui/layout";
import { PageHeader } from "@/components/ui/page";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useRealtimeRefresh } from "@/lib/client/socket";
import { RequirePermission } from "@/components/require-permission";

const CATEGORY_TONES: Record<string, string> = {
  PRODUCTIONS: "bg-purple/12 text-purple dark:bg-purple/20 dark:text-purple-300",
  WORKSHOPS: "bg-blue/12 text-blue dark:bg-blue/20 dark:text-blue-300",
  BEHIND_THE_SCENES: "bg-teal/12 text-teal dark:bg-teal/20 dark:text-teal-300",
  FESTIVALS: "bg-orange/12 text-orange dark:bg-orange/20 dark:text-orange-300",
  REHEARSALS: "bg-pink/12 text-pink dark:bg-pink/20 dark:text-pink-300",
  CLUB_LIFE: "bg-green/12 text-green dark:bg-green/20 dark:text-green-300",
};

const CATEGORY_ICONS: Record<string, IconName> = {
  PRODUCTIONS: "star",
  WORKSHOPS: "note",
  BEHIND_THE_SCENES: "camera",
  FESTIVALS: "trophy",
  REHEARSALS: "clock",
  CLUB_LIFE: "heart",
};

const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50;

function GalleryPage() {
  const { user } = useSession();
  const perms = user?.permissions ?? [];
  const canManage = perms.includes("gallery.manage");
  const canUpload = perms.includes("gallery.upload");
  const toast = useToast();

  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GalleryAlbum | null>(null);
  const [deleting, setDeleting] = useState<GalleryAlbum | null>(null);
  const [viewing, setViewing] = useState<GalleryAlbum | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAlbums(await apiGet<GalleryAlbum[]>("/api/gallery"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Live: refresh albums when new media is uploaded by anyone.
  useRealtimeRefresh(["GalleryAlbum", "GalleryItem"], load);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await apiDelete(`/api/gallery/${deleting.id}`);
      toast.success("Album deleted");
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
        icon="gallery"
        title="Gallery"
        subtitle={`${albums.length} albums of club memories`}
        actions={
          canManage && (
            <Button icon="folder" onClick={() => setCreating(true)}>
              New Album
            </Button>
          )
        }
      />

      {loading ? (
        <PageLoader label="Loading gallery…" />
      ) : albums.length === 0 ? (
        <EmptyState
          icon="gallery"
          title="No albums yet"
          message="Create an album to start collecting photos and videos."
        />
      ) : (
        <Grid preset="media">
          {albums.map((a) => (
            <div
              key={a.id}
              className="flex flex-col overflow-hidden rounded-apple border border-line bg-card shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-card-hover dark:border-white/10 dark:bg-[#0f172a]"
            >
              <button
                onClick={() => setViewing(a)}
                className="group text-left"
              >
                <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-accent-soft via-accent-soft/40 to-plum/15 dark:from-accent/20 dark:via-accent/10 dark:to-plum/30">
                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-2xl bg-white/80 text-ink shadow-card backdrop-blur dark:bg-white/10 dark:text-slate-100",
                      "transition-transform duration-300 group-hover:scale-110"
                    )}
                  >
                    <Icon name={CATEGORY_ICONS[a.category] || "image"} size={22} />
                  </span>
                  <span
                    className={cn(
                      "absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      CATEGORY_TONES[a.category] || "bg-black/5 text-sub"
                    )}
                  >
                    {albumCategoryLabel(a.category)}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="truncate text-[15.5px] font-bold tracking-tight text-ink dark:text-slate-100">
                    {a.name}
                  </h3>
                  <p className="mt-0.5 text-[12.5px] text-sub dark:text-slate-400">
                    {a._count?.items ?? 0} items
                    {a.department ? ` · ${a.department.name}` : ""} ·{" "}
                    {timeAgo(a.createdAt)}
                  </p>
                </div>
              </button>
              {canManage && (
                <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 dark:border-white/10">
                  <button
                    onClick={() => setEditing(a)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1.5 text-[12.5px] font-medium text-sub transition hover:bg-black/[0.08] hover:text-ink dark:bg-white/10 dark:text-slate-300 dark:hover:text-slate-100"
                  >
                    <Icon name="edit" size={13} />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleting(a)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1.5 text-[12.5px] font-medium text-sub transition hover:bg-red/10 hover:text-red dark:bg-white/10 dark:text-slate-300"
                  >
                    <Icon name="trash" size={13} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </Grid>
      )}

      {(creating || editing) && (
        <CreateAlbumModal
          album={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onCreated={() => {
            setCreating(false);
            setEditing(null);
            void load();
          }}
        />
      )}

      {viewing && (
        <AlbumModal
          album={viewing}
          canUpload={canUpload}
          canManage={canManage}
          onClose={() => setViewing(null)}
          onChanged={() => void load()}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open
          title="Delete album?"
          message={`"${deleting.name}" and all ${deleting._count?.items ?? 0} items inside it will be permanently removed.`}
          confirmLabel="Delete"
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

export default function GalleryPageRoute() {
  return (
    <RequirePermission anyOf={["gallery.upload", "gallery.manage"]}>
      <GalleryPage />
    </RequirePermission>
  );
}

/* ---------------- Create / edit album ---------------- */

function CreateAlbumModal({
  album,
  onClose,
  onCreated,
}: {
  album: GalleryAlbum | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({
    name: album?.name ?? "",
    category: album?.category ?? "CLUB_LIFE",
    departmentId: album?.departmentId ?? "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiGet<Department[]>("/api/departments").then(setDepartments).catch(() => {});
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Album name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        ...(form.departmentId ? { departmentId: form.departmentId } : {}),
      };
      if (album) {
        await apiPatch(`/api/gallery/${album.id}`, payload);
        toast.success("Album updated");
      } else {
        await apiPost("/api/gallery", payload);
        toast.success("Album created");
      }
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={album ? "Edit Album" : "New Album"}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Name">
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Spring Festival 2026"
          />
        </Field>
        <Field label="Category">
          <Select
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
          >
            {ALBUM_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {albumCategoryLabel(c)}
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
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" full type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button full type="submit" loading={saving}>
            {album ? "Save Changes" : "Create Album"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Album detail ---------------- */

function AlbumModal({
  album,
  canUpload,
  canManage,
  onClose,
  onChanged,
}: {
  album: GalleryAlbum;
  canUpload: boolean;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: GalleryItem[] }>(
        `/api/gallery/items?albumId=${album.id}&limit=100`
      );
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, [album.id]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const confirmDeleteItem = async () => {
    if (!deleteItemId) return;
    try {
      await apiDelete(`/api/gallery/items/${deleteItemId}`);
      toast.success("Item removed");
      setDeleteItemId(null);
      void load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      setDeleteItemId(null);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith("video");
        const maxBytes = (isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1024 * 1024;
        if (file.size > maxBytes) {
          toast.error(`${file.name} exceeds the ${isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB} MB limit`);
          continue;
        }
        setUploadProgress(`Preparing ${file.name}…`);
        const signed = await apiPost<{ uploadUrl: string; key: string }>(
          "/api/gallery/upload-url",
          {
            fileName: file.name,
            contentType: file.type,
            fileSize: file.size,
            folder: "gallery",
          }
        );
        setUploadProgress(`Uploading ${file.name}…`);
        const put = await fetch(signed.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }
        await apiPost("/api/gallery/items", {
          albumId: album.id,
          r2Key: signed.key,
          fileName: file.name,
          type: isVideo ? "VIDEO" : "IMAGE",
        });
      }
      toast.success("Upload complete");
      void load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={album.name}
      subtitle={`${items.length} items · ${albumCategoryLabel(album.category)}`}
      size="xl"
    >
      <div className="space-y-4">
        {canUpload && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-line-strong/60 p-4 dark:border-white/15">
            <Icon name="upload" size={18} className="text-faint" />
            <p className="flex-1 text-[13px] text-sub dark:text-slate-400">
              {uploadProgress || "Upload images (max 10 MB) or videos (max 50 MB)"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/mp4,video/webm"
              multiple
              className="hidden"
              onChange={(e) => void uploadFiles(e.target.files)}
            />
            <Button
              size="sm"
              icon="upload"
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Files
            </Button>
          </div>
        )}

        {loading ? (
          <PageLoader label="Loading items…" />
        ) : items.length === 0 ? (
          <EmptyState
            icon="image"
            title="Album is empty"
            message={canUpload ? "Upload the first photo or video." : "Nothing here yet."}
          />
        ) : (
          <Grid preset="media">
            {items.map((item) => {
              const src = r2Url(item.r2Key);
              const isVideo = item.type === "VIDEO";
              return (
                <div
                  key={item.id}
                  className="group relative aspect-square overflow-hidden rounded-2xl border border-line bg-black/[0.04] dark:border-white/10 dark:bg-white/5"
                >
                  {src ? (
                    isVideo ? (
                      <video src={src} className="size-full object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={item.caption || item.fileName}
                        className="size-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    )
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 text-faint">
                      <Icon name={isVideo ? "video" : "image"} size={24} />
                      <span className="max-w-full truncate px-2 text-[11px]">
                        {item.fileName}
                      </span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2.5 pt-8 opacity-100 transition group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <p className="truncate text-[12px] font-medium text-white">
                      {item.caption || item.fileName}
                    </p>
                    <p className="text-[10.5px] text-white/70">{timeAgo(item.createdAt)}</p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => setDeleteItemId(item.id)}
                      className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/50 text-white opacity-100 backdrop-blur transition hover:bg-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Delete item"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </Grid>
        )}
      </div>

      {deleteItemId && (
        <ConfirmDialog
          open
          title="Remove this item?"
          message="The media entry will be removed from the gallery."
          confirmLabel="Remove"
          onConfirm={() => void confirmDeleteItem()}
          onClose={() => setDeleteItemId(null)}
        />
      )}
    </Modal>
  );
}
