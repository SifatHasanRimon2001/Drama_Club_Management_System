import Link from "next/link";
import { publicFetch } from "@/lib/server";
import type { Event } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";

export const metadata = { title: "Productions" };

export default async function ProductionsPage() {
  const productions = await publicFetch<Event[]>("/api/public/productions?limit=100");

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6">
      <div className="max-w-3xl">
        <p className="text-[13px] font-semibold uppercase tracking-widest text-accent">
          Past & Present
        </p>
        <h1 className="display-title mt-3 text-ink dark:text-gray-50">Productions</h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-sub dark:text-gray-400">
          From intimate one-acts to full-scale musicals — the work our members bring to
          the stage, season after season.
        </p>
      </div>

      {!productions || productions.length === 0 ? (
        <div className="mt-14">
          <EmptyState
            icon="star"
            title="No productions yet"
            message="Our next production is in the works. Check back soon!"
          />
        </div>
      ) : (
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {productions.map((p) => (
            <article
              key={p.id}
              className="group relative overflow-hidden rounded-[22px] border border-line bg-card shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover dark:bg-[#1c1c1e] dark:border-white/10"
            >
              <div
                className="relative flex h-44 items-end overflow-hidden bg-gradient-to-br from-indigo/80 via-purple/70 to-accent/70 p-5"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(88,86,214,0.85), rgba(175,82,222,0.75) 55%, rgba(0,113,227,0.7))",
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{
                    background:
                      "radial-gradient(400px 200px at 85% 0%, rgba(255,255,255,0.35), transparent 60%)",
                  }}
                />
                <div className="relative flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold uppercase tracking-widest text-white/80">
                      {p.department?.name || "Club Production"}
                    </p>
                    <h2 className="mt-1 text-[22px] font-bold tracking-tight text-white">
                      {p.title}
                    </h2>
                  </div>
                  <StatusPill value={p.status} className="bg-white/20 text-white backdrop-blur" />
                </div>
              </div>
              <div className="p-5">
                {p.description && (
                  <p className="line-clamp-2 text-[14px] leading-relaxed text-sub dark:text-gray-400">
                    {p.description}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-sub dark:text-gray-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="calendar" size={14} />
                    {formatDate(p.startAt)}
                  </span>
                  {p.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="pin" size={14} />
                      {p.location}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-16 flex justify-center">
        <Link
          href="/events"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-card px-6 text-[14.5px] font-medium text-ink shadow-card transition hover:bg-white dark:bg-[#1c1c1e] dark:text-gray-100"
        >
          See all events <Icon name="chevron-right" size={14} />
        </Link>
      </div>
    </div>
  );
}
