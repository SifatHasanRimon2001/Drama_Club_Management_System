"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";

export interface MediaItem {
  id: string;
  type: "IMAGE" | "VIDEO";
  url: string | null;
  caption: string | null;
  fileName: string;
}

export function MediaGrid({ items }: { items: MediaItem[] }) {
  const [active, setActive] = useState<MediaItem | null>(null);

  return (
    <>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {items.map((item) => (
          <figure
            key={item.id}
            className="group relative aspect-square rounded-2xl border border-line bg-black/5 dark:bg-white/5"
          >
            {item.type === "VIDEO" && item.url ? (
              <button
                type="button"
                onClick={() => setActive(item)}
                className="block size-full"
                aria-label={`Play video${item.caption ? `: ${item.caption}` : ""}`}
              >
                <video
                  src={item.url}
                  className="pointer-events-none size-full object-cover"
                  preload="metadata"
                  muted
                  playsInline
                  aria-hidden="true"
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition group-hover:scale-110">
                    <Icon name="play" size={18} />
                  </span>
                </span>
              </button>
            ) : item.url ? (
              <button
                type="button"
                onClick={() => setActive(item)}
                className="block size-full"
                aria-label={`View image${item.caption ? `: ${item.caption}` : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.caption || item.fileName}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                />
              </button>
            ) : (
              <div className="flex size-full items-center justify-center text-faint">
                <Icon name={item.type === "VIDEO" ? "video" : "image"} size={32} />
              </div>
            )}
            {item.caption && (
              <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-10 text-[12.5px] font-medium text-white transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                {item.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      <Modal
        open={active !== null}
        onClose={() => setActive(null)}
        title="Preview"
        size="xl"
      >
        {active && active.url && (
          <div className="flex flex-col items-center gap-4">
            {active.type === "VIDEO" ? (
              <video src={active.url} className="max-h-[70dvh] w-full rounded-2xl" controls playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.url}
                alt={active.caption || active.fileName}
                className="max-h-[70dvh] w-auto rounded-2xl object-contain"
              />
            )}
            {active.caption && (
              <p className="text-[14px] text-sub">{active.caption}</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}