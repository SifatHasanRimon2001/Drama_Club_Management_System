import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publicFetch } from "@/lib/server";
import type { Event } from "@/lib/types";
import { EVENT_TYPES, formatDateTime, formatTime } from "@/lib/format";
import { Icon } from "@/components/icons";
import { StatusPill } from "@/components/ui/badge";
import { Container } from "@/components/ui/layout";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await publicFetch<Event>(`/api/public/events/${id}`);
  return { title: event?.title ? `${event.title}` : "Event" };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await publicFetch<Event>(`/api/public/events/${id}`);

  if (!event) notFound();

  const date = new Date(event.startAt);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6">
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-sub transition hover:text-ink dark:text-gray-400 dark:hover:text-gray-100"
      >
        <Icon name="chevron-left" size={14} />
        All events
      </Link>

      <div className="mt-6 rounded-apple border border-line bg-card p-6 shadow-card sm:p-10 dark:bg-[#1c1c1e] dark:border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex w-20 shrink-0 flex-col items-center rounded-2xl bg-accent-soft py-3 text-accent">
            <span className="text-[28px] font-bold leading-none">{date.getDate()}</span>
            <span className="mt-1 text-[12px] font-semibold uppercase tracking-wide">
              {date.toLocaleString(undefined, { month: "short" })}
            </span>
            <span className="text-[11px] font-medium text-faint">
              {date.getFullYear()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-bold tracking-tight text-ink sm:text-[28px] dark:text-gray-50">
                {event.title}
              </h1>
              <StatusPill value={event.type} />
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-sub dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="clock" size={14} />
                {formatDateTime(event.startAt)}
                {event.endAt && ` – ${formatTime(event.endAt)}`}
              </span>
              {event.location && (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="pin" size={14} />
                  {event.location}
                </span>
              )}
              {event.department && (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="folder" size={14} />
                  {event.department.name}
                </span>
              )}
            </p>
          </div>
        </div>

        {event.description ? (
          <div className="mt-8 border-t border-line pt-8 dark:border-white/10">
            <p className="whitespace-pre-line text-[15.5px] leading-relaxed text-ink dark:text-gray-200">
              {event.description}
            </p>
          </div>
        ) : (
          <p className="mt-8 border-t border-line pt-8 text-[14.5px] text-sub dark:border-white/10 dark:text-gray-400">
            No description provided for this event.
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-6 dark:border-white/10">
          {EVENT_TYPES.filter((t) => t !== event.type).map((t) => (
            <Link
              key={t}
              href={`/events?type=${t}`}
              className="rounded-full border border-line px-3.5 py-1.5 text-[12.5px] font-medium text-sub transition hover:border-accent/40 hover:text-accent dark:border-white/15 dark:text-gray-400"
            >
              More {t.charAt(0) + t.slice(1).toLowerCase()} events
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
