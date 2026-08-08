import Link from "next/link";
import { publicFetch } from "@/lib/server";
import type { Event } from "@/lib/types";
import { formatDateTime, formatTime, EVENT_TYPES } from "@/lib/format";
import { Icon } from "@/components/icons";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Container, Toolbar } from "@/components/ui/layout";
import { PageIntro } from "@/components/ui/page";
import { TicketStub } from "@/components/ticket-stub";
import { cn } from "@/lib/cn";

export const metadata = { title: "Events" };

export const revalidate = 30;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; upcoming?: string }>;
}) {
  const sp = await searchParams;
  const type = EVENT_TYPES.includes(sp.type as (typeof EVENT_TYPES)[number])
    ? sp.type
    : undefined;
  const upcoming = sp.upcoming !== "false";
  const qs = new URLSearchParams({
    limit: "100",
    upcoming: String(upcoming),
    ...(type ? { type } : {}),
  });

  const events = await publicFetch<Event[]>(`/api/public/events?${qs}`);

  return (
<Container size="page" className="pb-24 pt-28">
      <PageIntro
        eyebrow="What's happening"
        title="Events"
        subtitle="Workshops, rehearsals, auditions, performances and festivals — everything on the club calendar."
      />

      <Toolbar className="mt-10">
        <Link
          href={`/events?upcoming=true${type ? `&type=${type}` : ""}`}
          aria-current={upcoming ? "true" : undefined}
          className={cn(
            "inline-flex items-center rounded-full px-4 py-2 text-[13.5px] font-medium transition",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            upcoming
              ? "bg-gradient-to-br from-gold-light via-gold to-[#1e40af] font-bold text-white shadow-gold"
              : "border border-line bg-card text-sub hover:text-ink dark:bg-[#0f172a] dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          Upcoming
        </Link>
        <Link
          href={`/events?upcoming=false${type ? `&type=${type}` : ""}`}
          aria-current={!upcoming ? "true" : undefined}
          className={cn(
            "inline-flex items-center rounded-full px-4 py-2 text-[13.5px] font-medium transition",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            !upcoming
              ? "bg-gradient-to-br from-gold-light via-gold to-[#1e40af] font-bold text-white shadow-gold"
              : "border border-line bg-card text-sub hover:text-ink dark:bg-[#0f172a] dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          All
        </Link>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
        {EVENT_TYPES.map((t) => (
          <Link
            key={t}
            href={`/events?upcoming=${upcoming}&type=${type === t ? "" : t}`}
            aria-current={type === t ? "true" : undefined}
            className={cn(
              "inline-flex items-center rounded-full px-3.5 py-2 text-[13px] font-medium transition",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              type === t
                ? "bg-black/[0.08] text-ink dark:bg-white/20 dark:text-white"
                : "text-sub hover:text-ink dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </Link>
        ))}
      </Toolbar>

      {!events || events.length === 0 ? (
        <div className="mt-14">
          <EmptyState
            icon="calendar"
            title={upcoming ? "No upcoming events" : "No events yet"}
            message={
              upcoming
                ? "Nothing scheduled at the moment — check back soon."
                : "Events will appear here once they're published."
            }
          />
        </div>
      ) : (
        <div className="mt-10 space-y-3.5">
          {events.map((e) => {
            const date = new Date(e.startAt);
            return (
              <article
                key={e.id}
                className="group overflow-hidden rounded-apple border border-line bg-card shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-card-hover dark:bg-[#0f172a] dark:border-white/10"
              >
                <Link href={`/events/${e.id}`} className="flex w-full flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
                <TicketStub date={date} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[16.5px] font-semibold tracking-tight text-ink group-hover:text-accent dark:text-slate-100">
                      {e.title}
                    </h2>
                    <StatusPill value={e.type} />
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-sub dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="clock" size={13} />
                      {formatDateTime(e.startAt)}
                      {e.endAt && ` – ${formatTime(e.endAt)}`}
                    </span>
                    {e.location && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="pin" size={13} />
                        {e.location}
                      </span>
                    )}
                    {e.department && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="folder" size={13} />
                        {e.department.name}
                      </span>
                    )}
                  </p>
                </div>
                <StatusPill value={e.status} />
                <span className="text-faint transition group-hover:text-accent" aria-hidden="true">
                  <Icon name="chevron-right" size={16} />
                </span>
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </Container>
  );
}
