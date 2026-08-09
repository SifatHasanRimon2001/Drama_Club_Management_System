import Link from "next/link";
import { publicFetch } from "@/lib/server";
import type { ClubUpdate } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Container } from "@/components/ui/layout";
import { PageIntro } from "@/components/ui/page";

export const metadata = { title: "Updates" };

export const revalidate = 30;

export default async function UpdatesPage() {
  const updates = await publicFetch<ClubUpdate[]>("/api/public/updates?limit=100");

  return (
    <Container size="article" className="pb-24 pt-28">
      <PageIntro
        eyebrow="News & announcements"
        title="Club Updates"
        subtitle="The latest from the BRAC University Drama Club — announcements, achievements and everything happening backstage."
      />

      {!updates || updates.length === 0 ? (
        <div className="mt-14">
          <EmptyState
            icon="doc"
            title="No updates yet"
            message="Check back soon — new club updates are on the way."
          />
        </div>
      ) : (
        <div className="mt-12 space-y-4">
          {updates.map((u) => (
            <Link
              key={u.id}
              href={`/updates/${u.id}`}
              className="group flex flex-col gap-3 rounded-apple border border-line bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover sm:flex-row sm:items-start sm:gap-5 dark:bg-card dark:border-white/10"
            >
              <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-start">
                <StatusPill value={u.category} />
                <span className="text-[12px] text-faint dark:text-slate-400">{formatDate(u.publishedAt)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[17px] font-semibold tracking-tight text-ink group-hover:text-accent dark:text-slate-100">
                  {u.title}
                </h2>
                {u.bodyRichText && (
                  <p className="mt-1.5 line-clamp-3 text-[13.5px] leading-relaxed text-sub dark:text-slate-400">
                    {stripHtml(u.bodyRichText)}
                  </p>
                )}
                {u.author?.name && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] text-faint dark:text-slate-400">
                    <Icon name="user" size={12} />
                    {u.author.name}
                  </p>
                )}
              </div>
              <Icon
                name="chevron-right"
                size={16}
                aria-hidden="true"
                className="hidden shrink-0 self-center text-faint transition group-hover:translate-x-0.5 group-hover:text-accent sm:block"
              />
            </Link>
          ))}
          {updates && updates.length >= 100 && (
            <p className="pt-2 text-center text-[13px] text-faint">
              Showing the most recent 100 updates.
            </p>
          )}
        </div>
      )}
    </Container>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
