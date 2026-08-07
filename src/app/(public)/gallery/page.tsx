import Link from "next/link";
import { publicFetch, r2Url } from "@/lib/server";
import type { GalleryAlbum } from "@/lib/types";
import { ALBUM_CATEGORIES } from "@/lib/format";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/ui/feedback";
import { Grid } from "@/components/ui/layout";

export const metadata = { title: "Gallery" };

const CATEGORY_STYLES: Record<string, { icon: "camera" | "note" | "film" | "trophy" | "clock" | "heart" | "star"; grad: string }> = {
  PRODUCTIONS: { icon: "star", grad: "from-indigo/70 to-purple/70" },
  WORKSHOPS: { icon: "note", grad: "from-teal/70 to-cyan/70" },
  BEHIND_THE_SCENES: { icon: "camera", grad: "from-faint/60 to-sub/70" },
  FESTIVALS: { icon: "trophy", grad: "from-orange/70 to-yellow/60" },
  REHEARSALS: { icon: "clock", grad: "from-blue/70 to-indigo/70" },
  CLUB_LIFE: { icon: "heart", grad: "from-pink/70 to-red/60" },
};

export default async function GalleryPage() {
  const albums = await publicFetch<GalleryAlbum[]>("/api/public/gallery");

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6">
      <div className="max-w-3xl">
        <p className="text-[13px] font-semibold uppercase tracking-widest text-accent">
          Moments on & off stage
        </p>
        <h1 className="display-title mt-3 text-ink dark:text-gray-50">Gallery</h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-sub dark:text-gray-400">
          A visual record of our productions, workshops and club life.
        </p>
      </div>

      {!albums || albums.length === 0 ? (
        <div className="mt-14">
          <EmptyState
            icon="gallery"
            title="No albums yet"
            message="Photos and videos will be published here after our next event."
          />
        </div>
      ) : (
        <Grid preset="cards" className="mt-14">
          {albums.map((album) => {
            const cover = album.items?.[0];
            const coverUrl = cover ? r2Url(cover.r2Key) : null;
            const style = CATEGORY_STYLES[album.category] || CATEGORY_STYLES.PRODUCTIONS;
            return (
              <Link
                key={album.id}
                href={`/gallery/${album.id}`}
                className="group overflow-hidden rounded-apple border border-line bg-card shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover dark:bg-[#1c1c1e] dark:border-white/10"
              >
                <div className="relative h-48 overflow-hidden bg-black/5 dark:bg-white/5">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverUrl}
                      alt={album.name}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className={`flex size-full items-center justify-center bg-gradient-to-br ${style.grad} text-white/90`}
                    >
                      <Icon name={style.icon} size={40} />
                    </div>
                  )}
                  <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur">
                    <Icon name="gallery" size={12} />
                    {album._count?.items ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <h2 className="truncate text-[16.5px] font-semibold tracking-tight text-ink dark:text-gray-100">
                      {album.name}
                    </h2>
                    <p className="mt-0.5 text-[13px] text-sub dark:text-gray-400">
                      {ALBUM_CATEGORIES.includes(album.category as (typeof ALBUM_CATEGORIES)[number])
                        ? album.category.charAt(0) + album.category.slice(1).toLowerCase().replace(/_/g, " ")
                        : album.category}
                      {album.department ? ` · ${album.department.name}` : ""}
                    </p>
                  </div>
                  <Icon
                    name="chevron-right"
                    size={16}
                    className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                  />
                </div>
              </Link>
            );
          })}
        </Grid>
      )}
    </div>
  );
}
