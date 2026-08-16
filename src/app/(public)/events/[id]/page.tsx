import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publicFetch } from "@/lib/server";
import type { Event } from "@/lib/types";
import { EVENT_TYPES, formatDateTime, formatTime } from "@/lib/format";
import { Icon } from "@/components/icons";
import { StatusPill } from "@/components/ui/badge";
import { TicketStub } from "@/components/ticket-stub";
import { Container } from "@/components/ui/layout";
import { BackLink } from "@/components/ui/page";

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
    <Container size="article" className="pb-24 pt-24">
      <BackLink href="/events">All events</BackLink>

      <div className="relative mt-6 overflow-hidden rounded-apple border border-line bg-card shadow-card dark:bg-card dark:border-white/10">
        <div className="p-6 sm:p-10">
          <p className="theatre-eyebrow text-accent">
            <Icon name="ticket" size={12} />
            Event details
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <TicketStub date={date} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[30px] dark:text-[#faf4e6]">
                  {event.title}
                </h1>
                <StatusPill value={event.type} />
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-sub">
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
            <p className="whitespace-pre-line text-[15.5px] leading-relaxed text-ink">
              {event.description}
            </p>
          </div>
        ) : (
          <p className="mt-8 border-t border-line pt-8 text-[14.5px] text-sub dark:border-white/10">
            No description provided for this event.
          </p>
        )}

        {/* Tickets / RSVP CTA */}
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-accent-soft/40 px-5 py-4 dark:bg-accent/10">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-light via-gold to-[#1e40af] text-white dark:bg-accent dark:bg-none dark:text-on-accent shadow-gold">
            <Icon name="ticket" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold text-ink">Tickets & RSVPs</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-sub">
              Seating is arranged through the club — message us and we&apos;ll save your place.
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-br from-gold-light via-gold to-[#1e40af] px-6 text-[14.5px] font-bold text-white shadow-gold transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Get Tickets
            <Icon name="arrow-right" size={15} />
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-6 dark:border-white/10">
          {EVENT_TYPES.filter((t) => t !== event.type).map((t) => (
            <Link
              key={t}
              href={`/events?type=${t}`}
              className="rounded-full border border-line px-3.5 py-1.5 text-[12.5px] font-medium text-sub transition hover:border-accent/40 hover:text-accent dark:border-white/15"
            >
              More {t.charAt(0) + t.slice(1).toLowerCase()} events
            </Link>
          ))}
        </div>
        </div>
      </div>
    </Container>
  );
}
