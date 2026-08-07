import Link from "next/link";
import { publicFetch } from "@/lib/server";
import type { ClubUpdate } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";

export const metadata = { title: "Updates" };

export const revalidate = 30;

export default async function UpdatesPage() {
  const updates = await publicFetch<ClubUpdate[]>("/api/public/updates?limit=100");

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6">
      <p className="text-[13px] font-semibold uppercase tracking-widest text-accent">
        News &amp; announcements
      </p>
      <h1 className="display-title mt-3 text-ink dark:text-gray-50">Club Updates</h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-sub dark:text-gray-400">
        The latest from the Drama Club — announcements, achievements and everything
        happening backstage.
      </p>

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
              className="group flex flex-col gap-3 rounded-apple border border-line bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover sm:flex-row sm:items-start sm:gap-5 dark:bg-[#1c1c1e] dark:border-white/10"
            >
              <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-start">
                <StatusPill value={u.category} />
                <span className="text-[12px] text-faint">{formatDate(u.publishedAt)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-semibold tracking-tight text-ink group-hover:text-accent dark:text-gray-100">
                  {u.title}
                </h2>
                {u.bodyRichText && (
                  <div
                    className="rich-text mt-1.5 line-clamp-3 text-[13.5px] text-sub dark:text-gray-400"
                    dangerouslySetInnerHTML={{ __html: u.bodyRichText }}
                  />
                )}
                {u.author?.name && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] text-faint">
                    <Icon name="user" size={12} />
                    {u.author.name}
                  </p>
                )}
              </div>
              <Icon
                name="chevron-right"
                size={16}
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
    </div>
  );
}
