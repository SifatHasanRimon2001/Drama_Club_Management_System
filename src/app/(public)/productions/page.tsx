import Link from "next/link";
import { publicFetch } from "@/lib/server";
import type { Event } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { prettyLabel } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Container, Grid } from "@/components/ui/layout";
import { PageIntro } from "@/components/ui/page";

export const metadata = { title: "Productions" };

export default async function ProductionsPage() {
  const productions = await publicFetch<Event[]>("/api/public/productions?limit=100");

  return (
<Container size="page" className="pb-24 pt-28">
      <PageIntro
        eyebrow="Past & Present"
        title="Productions"
        subtitle="From intimate one-acts to full-scale musicals — the work our members bring to the stage, season after season."
      />

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
              className="group overflow-hidden rounded-apple border border-line bg-card shadow-card transition-all hover:-translate-y-1 hover:border-accent/40 hover:shadow-card-hover dark:bg-card dark:border-white/10"
            >
              {/* Poster: quiet slate band with the production mark */}
              <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                <span className="flex size-14 items-center justify-center rounded-full border border-accent/30 bg-card/70 text-accent backdrop-blur-sm">
                  <Icon name="star" size={22} />
                </span>
              </div>
              <div className="p-5">
                <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-accent">
                  {p.department?.name || "Club Production"}
                </p>
                <h2 className="font-display mt-1.5 text-[20px] font-bold tracking-tight text-ink">
                  {p.title}
                </h2>
                {p.description && (
                  <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-sub">
                    {p.description}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-4 text-[13px] text-sub dark:border-white/10">
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
                  <span className="ml-auto inline-flex items-center rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-ink">
                    {prettyLabel(p.status)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </Grid>
      )}

      <div className="mt-16 flex justify-center">
        <Link
          href="/events"
          className="bg-card inline-flex h-11 items-center gap-2 rounded-full border border-line bg-card px-5 text-[14.5px] font-medium text-ink shadow-card transition hover:bg-black/[0.03] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:hover:/10"
        >
          See all events <Icon name="chevron-right" size={14} />
        </Link>
      </div>
    </Container>
  );
}
