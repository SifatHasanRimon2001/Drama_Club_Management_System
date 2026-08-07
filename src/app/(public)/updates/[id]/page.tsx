import Link from "next/link";
import { notFound } from "next/navigation";
import { publicFetch } from "@/lib/server";
import type { ClubUpdate } from "@/lib/types";
import { formatDateTime, updateCategoryLabel } from "@/lib/format";
import { Icon } from "@/components/icons";
import { StatusPill } from "@/components/ui/badge";

export const revalidate = 30;

export default async function UpdateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const update = await publicFetch<ClubUpdate>(`/api/public/updates/${id}`);

  if (!update) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6">
      <Link
        href="/updates"
        className="mb-8 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-sub transition hover:text-ink dark:text-gray-400 dark:hover:text-gray-100"
      >
        <Icon name="chevron-left" size={14} />
        All updates
      </Link>

      <div className="flex flex-wrap items-center gap-2.5">
        <StatusPill value={update.category} />
        <span className="text-[13px] text-faint">
          {formatDateTime(update.publishedAt)}
        </span>
        {update.author?.name && (
          <span className="flex items-center gap-1.5 text-[13px] text-faint">
            · <Icon name="user" size={12} /> {update.author.name}
          </span>
        )}
      </div>

      <h1 className="mt-4 text-[30px] font-bold leading-tight tracking-tight text-ink sm:text-[36px] dark:text-gray-50">
        {update.title}
      </h1>

      {update.mediaUrls && update.mediaUrls.length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {update.mediaUrls.slice(0, 4).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={update.title}
              className="aspect-video w-full rounded-2xl border border-line object-cover dark:border-white/10"
            />
          ))}
        </div>
      )}

      {update.bodyRichText ? (
        <div
          className="rich-text mt-8 text-[16px] leading-[1.75] text-ink dark:text-gray-200"
          dangerouslySetInnerHTML={{ __html: update.bodyRichText }}
        />
      ) : (
        <p className="mt-8 text-[15px] text-sub dark:text-gray-400">
          No additional details provided. {updateCategoryLabel(update.category)} — {update.title}
        </p>
      )}

      <div className="mt-14 rounded-2xl border border-line p-6 text-center dark:border-white/10">
        <p className="text-[15px] font-semibold text-ink dark:text-gray-100">
          Don&apos;t miss the next update
        </p>
        <p className="mt-1 text-[13.5px] text-sub dark:text-gray-400">
          Follow our productions and events page for what&apos;s coming up.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/events"
            className="rounded-full bg-accent px-5 py-2 text-[13.5px] font-medium text-white transition hover:bg-accent-hover"
          >
            Upcoming Events
          </Link>
          <Link
            href="/recruitment"
            className="rounded-full border border-line px-5 py-2 text-[13.5px] font-medium text-ink transition hover:bg-black/[0.03] dark:text-gray-100 dark:hover:bg-white/10"
          >
            Join the Club
          </Link>
        </div>
      </div>
    </article>
  );
}
