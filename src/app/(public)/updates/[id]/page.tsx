import Link from "next/link";
import { notFound } from "next/navigation";
import { publicFetch } from "@/lib/server";
import type { ClubUpdate } from "@/lib/types";
import { formatDateTime, updateCategoryLabel } from "@/lib/format";
import { Icon } from "@/components/icons";
import { StatusPill } from "@/components/ui/badge";
import { Container, Grid } from "@/components/ui/layout";
import { BackLink } from "@/components/ui/page";

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
    <Container size="article" className="pb-24 pt-24">
      <article>
      <BackLink href="/updates" className="mb-8">All updates</BackLink>

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

      <h1 className="mt-4 text-[30px] font-bold leading-tight tracking-tight text-ink sm:text-[36px] dark:text-[#faf4e6]">
        {update.title}
      </h1>

      {update.mediaUrls && update.mediaUrls.length > 0 && (
        <Grid preset="fields" className="mt-4">
          {update.mediaUrls.slice(0, 4).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={update.title}
              className="aspect-video w-full rounded-2xl border border-line object-cover dark:border-white/10"
            />
          ))}
        </Grid>
      )}

      {update.bodyRichText ? (
        <div
          className="rich-text mt-8 text-[16px] leading-[1.75] text-ink"
          dangerouslySetInnerHTML={{ __html: update.bodyRichText }}
        />
      ) : (
        <p className="mt-8 text-[15px] text-sub">
          No additional details provided. {updateCategoryLabel(update.category)} — {update.title}
        </p>
      )}

      <div className="mt-14 rounded-apple border border-line bg-card p-6 text-center shadow-card sm:p-8 dark:border-white/10 dark:bg-card">
        <p className="text-[15px] font-semibold text-ink">
          Don&apos;t miss the next update
        </p>
        <p className="mt-1 text-[13.5px] text-sub">
          Follow our productions and events page for what&apos;s coming up.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/events"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-br from-gold-light via-gold to-[#1e40af] px-6 text-sm font-bold text-white shadow-gold transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Upcoming Events
            <Icon name="chevron-right" size={14} />
          </Link>
          <Link
            href="/recruitment"
            className="bg-card inline-flex h-11 items-center rounded-full border border-line bg-card px-6 text-sm font-medium text-ink transition hover:bg-black/[0.03] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:hover:/10"
          >
            Join the Club
          </Link>
        </div>
      </div>
      </article>
    </Container>
  );
}
