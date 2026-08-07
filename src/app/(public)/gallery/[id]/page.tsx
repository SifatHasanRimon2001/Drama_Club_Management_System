import Link from "next/link";
import { notFound } from "next/navigation";
import { publicFetch, r2Url } from "@/lib/server";
import type { GalleryAlbum } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/ui/feedback";

export const metadata = { title: "Album" };

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const album = await publicFetch<GalleryAlbum>(`/api/public/gallery/${id}`);
  if (!album) notFound();

  const items = album.items || [];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6">
      <Link
        href="/gallery"
        className="inline-flex items-center gap-1 text-[13.5px] font-medium text-sub transition hover:text-accent"
      >
        <Icon name="chevron-left" size={14} />
        Gallery
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-title text-[2.2rem] text-ink dark:text-gray-50">{album.name}</h1>
          <p className="mt-2 text-[14px] text-sub dark:text-gray-400">
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
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {items.map((item) => {
            const url = r2Url(item.r2Key);
            return (
              <figure
                key={item.id}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-line bg-black/5 dark:bg-white/5"
              >
                {item.type === "VIDEO" ? (
                  <div className="relative size-full">
                    {url ? (
                      <video
                        src={url}
                        className="size-full object-cover"
                        preload="metadata"
                        muted
                        playsInline
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-faint">
                        <Icon name="video" size={32} />
                      </div>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex size-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition group-hover:scale-110">
                        <Icon name="play" size={18} />
                      </span>
                    </span>
                  </div>
                ) : url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={item.caption || item.fileName}
                    loading="lazy"
                    className="size-full cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-faint">
                    <Icon name="image" size={32} />
                  </div>
                )}
                {item.caption && (
                  <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8 text-[12.5px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {item.caption}
                  </figcaption>
                )}
              </figure>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-center text-[12.5px] text-faint">
        Uploaded {items.length > 0 ? timeAgo(items[items.length - 1].createdAt) : ""}
        {" · "}© {new Date().getFullYear()} Drama Club
      </p>
    </div>
  );
}
