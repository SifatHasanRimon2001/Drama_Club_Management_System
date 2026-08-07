import Link from "next/link";
import { publicFetch } from "@/lib/server";
import type { Event } from "@/lib/types";
import { formatDateTime, formatTime, EVENT_TYPES } from "@/lib/format";
import { Icon } from "@/components/icons";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Container, Toolbar } from "@/components/ui/layout";
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
      <div className="max-w-3xl">
        <p className="text-[13px] font-semibold uppercase tracking-widest text-accent">
          What&apos;s happening
        </p>
        <h1 className="display-title mt-3 text-ink dark:text-gray-50">Events</h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-sub dark:text-gray-400">
          Workshops, rehearsals, auditions, performances and festivals — everything on
          the club calendar.
        </p>
      </div>

      <Toolbar className="mt-10">
        <Link
          href={`/events?upcoming=true${type ? `&type=${type}` : ""}`}
          aria-current={upcoming ? "true" : undefined}
          className={cn(
            "inline-flex items-center rounded-full px-4 py-2 text-[13.5px] font-medium transition",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            upcoming
              ? "bg-accent text-white"
              : "border border-line bg-card text-sub hover:text-ink dark:bg-[#1c1c1e] dark:text-gray-400 dark:hover:text-gray-200"
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
              ? "bg-accent text-white"
              : "border border-line bg-card text-sub hover:text-ink dark:bg-[#1c1c1e] dark:text-gray-400 dark:hover:text-gray-200"
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
                : "text-sub hover:text-ink dark:text-gray-400 dark:hover:text-gray-200"
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
                className="group flex flex-wrap items-center gap-4 rounded-apple border border-line bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover sm:px-6 dark:bg-[#1c1c1e] dark:border-white/10"
              >
                <Link href={`/events/${e.id}`} className="flex w-full flex-wrap items-center gap-4">
                <div className="flex w-16 shrink-0 flex-col items-center rounded-2xl bg-accent-soft py-2.5 text-accent">
                  <span className="text-[22px] font-bold leading-none">{date.getDate()}</span>
                  <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide">
                    {date.toLocaleString(undefined, { month: "short" })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[16.5px] font-semibold tracking-tight text-ink group-hover:text-accent dark:text-gray-100">
                      {e.title}
                    </h2>
                    <StatusPill value={e.type} />
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-sub dark:text-gray-400">
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
