import Link from "next/link";
import { publicFetch } from "@/lib/server";
import type { Event } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { prettyLabel } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Container, Grid } from "@/components/ui/layout";

export const metadata = { title: "Productions" };

export default async function ProductionsPage() {
  const productions = await publicFetch<Event[]>("/api/public/productions?limit=100");

  return (
    <Container size="page" className="pb-24 pt-28">
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
        <Grid preset="split" className="mt-14">
          {productions.map((p) => (
            <Link
              key={p.id}
              href={`/events/${p.id}`}
              className="group relative overflow-hidden rounded-apple border border-line bg-card shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover dark:bg-[#1c1c1e] dark:border-white/10"
            >
              <div className="relative flex h-44 items-end overflow-hidden bg-gradient-to-br from-indigo/80 via-purple/70 to-accent/70 p-5">
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
                  <span className="inline-flex items-center rounded-full bg-white/25 px-2.5 py-1 text-[12px] font-semibold leading-none text-white backdrop-blur">
                    {prettyLabel(p.status)}
                  </span>
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
            </Link>
          ))}
        </Grid>
      )}

      <div className="mt-16 flex justify-center">
        <Link
          href="/events"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-card px-5 text-[14.5px] font-medium text-ink shadow-card transition hover:bg-black/[0.03] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:bg-[#1c1c1e] dark:text-gray-100 dark:hover:bg-white/10"
        >
          See all events <Icon name="chevron-right" size={14} />
        </Link>
      </div>
    </Container>
  );
}
