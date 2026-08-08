import { notFound } from "next/navigation";
import { publicFetch, r2Url } from "@/lib/server";
import type { GalleryAlbum } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { EmptyState } from "@/components/ui/feedback";
import { Container } from "@/components/ui/layout";
import { BackLink } from "@/components/ui/page";

import { MediaGrid, type MediaItem } from "./media-grid";

export const metadata = { title: "Album" };

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const album = await publicFetch<GalleryAlbum>(`/api/public/gallery/${id}`);
  if (!album) notFound();

  const items = album.items || [];
  const withUrls: MediaItem[] = items.map((item) => ({
    id: item.id,
    type: item.type === "VIDEO" ? "VIDEO" : "IMAGE",
    url: r2Url(item.r2Key),
    caption: item.caption || null,
    fileName: item.fileName,
  }));

  return (
    <Container size="page" className="pb-24 pt-24">
      <BackLink href="/gallery">Gallery</BackLink>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-title text-ink dark:text-[#faf4e6]">{album.name}</h1>
          <p className="mt-2 text-[14px] text-sub dark:text-slate-400">
            {album.category.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
            {album.department ? ` · ${album.department.name}` : ""} · {items.length} item
            {items.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon="gallery"
            title="This album is empty"
            message="Media will appear here as it's uploaded."
          />
        </div>
      ) : (
        <MediaGrid items={withUrls} />
      )}

      <p className="mt-8 text-center text-[12.5px] text-faint dark:text-slate-400">
        Uploaded {items.length > 0 ? timeAgo(items[items.length - 1].createdAt) : ""}
      </p>
    </Container>
  );
}