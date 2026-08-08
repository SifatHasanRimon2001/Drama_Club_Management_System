import Link from "next/link";
import { publicFetch } from "@/lib/server";
import type { PublicAbout, PublicHomeData } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Container, Grid } from "@/components/ui/layout";
import { TicketStub } from "@/components/ticket-stub";
import { cn } from "@/lib/cn";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const [about, home] = await Promise.all([
    publicFetch<PublicAbout>("/api/public/about"),
    publicFetch<PublicHomeData>("/api/public/home"),
  ]);

  const clubName = about?.clubName || "BRAC University Drama Club";
  const description =
    about?.clubDescription ||
    "Where passion meets the stage — join a community of storytellers, performers and creators.";

  return (
    <div className="dark:bg-[#0a0f1a]">
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 spotlight" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 vignette" aria-hidden="true" />

        <Container size="page" className="relative flex min-h-[70dvh] flex-col items-center justify-center pt-28 pb-16 text-center">
          <span className="theatre-eyebrow mb-6 text-accent">
            {about?.activeMemberCount != null
              ? `${about.activeMemberCount} members · ${about.departmentCount ?? 0} departments`
              : "Est. Backstage at BRAC"}
          </span>
          <h1 className="display-title animate-rise max-w-4xl text-ink dark:text-[#faf4e6]">
            {clubName}
          </h1>
          <p className="animate-rise mt-5 max-w-2xl text-[16px] leading-relaxed text-sub sm:text-[18px] dark:text-slate-400">
            {description}
          </p>
          <div className="animate-rise mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/recruitment"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-6 text-[15px] font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] shadow-sm hover:shadow-md"
            >
              Join the Club
              <Icon name="arrow-right" size={15} />
            </Link>
            <Link
              href="/productions"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white/80 px-6 text-[15px] font-semibold text-ink backdrop-blur transition hover:bg-white active:scale-[0.98] dark:bg-white/5 dark:text-slate-100 dark:border-white/10 dark:hover:bg-white/10"
            >
              <Icon name="star" size={15} />
              Our Productions
            </Link>
          </div>
        </Container>
      </section>

      {/* ---------- Committee ---------- */}
      {home?.committee ? (
        <Container size="page" className="py-16">
          <SectionHeader
            eyebrow="Current Committee"
            title={`Committee ${home.committee.year}`}
            link={{ href: "/committee", label: "View full committee" }}
          />
          <Grid preset="stats" className="mt-8 lg:grid-cols-4">
            {home.committee.memberRoles.slice(0, 8).map((mr) => (
              <div
                key={mr.id}
                className="flex items-center gap-3.5 rounded-xl border border-gray-200/80 bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover dark:bg-[#1e293b] dark:border-white/8"
              >
                <Avatar name={mr.member.user.name} src={mr.member.user.image} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink dark:text-slate-100">
                    {mr.member.user.name}
                  </p>
                  <p className="truncate text-[12.5px] text-blue-600 dark:text-blue-400">{mr.role.name}</p>
                </div>
              </div>
            ))}
            {home.committee.memberRoles.length === 0 && (
              <p className="col-span-full text-center text-[13.5px] text-sub">
                Committee roles will be announced soon.
              </p>
            )}
          </Grid>
        </Container>
      ) : null}

      {/* ---------- Latest updates ---------- */}
      {home?.recentUpdates && home.recentUpdates.length > 0 ? (
        <Container size="page" className="py-8">
          <SectionHeader
            eyebrow="Latest News"
            title="Club Updates"
            link={{ href: "/updates", label: "All updates" }}
          />
          <Grid preset="cards" className="mt-8">
            {home.recentUpdates.slice(0, 6).map((u) => (
              <Link
                key={u.id}
                href={`/updates/${u.id}`}
                className="group flex flex-col rounded-xl border border-gray-200/80 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-[#1e293b] dark:border-white/8"
              >
                <div className="flex items-center justify-between">
                  <StatusPill value={u.category} />
                  <span className="text-[12px] text-faint">{formatDate(u.publishedAt)}</span>
                </div>
                <h3 className="mt-3 line-clamp-2 text-[15px] font-semibold tracking-tight text-ink group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                  {u.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-sub dark:text-slate-400">
                  {stripHtml(u.bodyRichText)}
                </p>
              </Link>
            ))}
          </Grid>
        </Container>
      ) : null}

      {/* ---------- Upcoming events ---------- */}
      {home?.upcomingEvents && home.upcomingEvents.length > 0 ? (
        <Container size="page" className="py-8">
          <SectionHeader
            eyebrow="Mark Your Calendar"
            title="Upcoming Events"
            link={{ href: "/events", label: "All events" }}
          />
          <div className="mt-8 space-y-3">
            {home.upcomingEvents.map((e) => (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200/80 bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover sm:px-5 dark:bg-[#1e293b] dark:border-white/8"
              >
                <TicketStub
                  date={new Date(e.startAt)}
                  size="sm"
                  className="min-w-[56px]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-ink dark:text-slate-100">
                    {e.title}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-sub dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="clock" size={12} />
                      {formatDateTime(e.startAt)}
                    </span>
                    {e.location && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="pin" size={12} />
                        {e.location}
                      </span>
                    )}
                    {e.department && <span>{e.department.name}</span>}
                  </p>
                </div>
                <StatusPill value={e.type} />
              </Link>
            ))}
          </div>
        </Container>
      ) : null}

      {/* ---------- Departments ---------- */}
      {home?.departments && home.departments.length > 0 ? (
        <Container size="page" className="py-8 pb-20">
          <SectionHeader
            eyebrow="Explore the Crew"
            title="Our Departments"
            link={{ href: "/departments", label: "All departments" }}
          />
          <Grid preset="cards" className="mt-8">
            {home.departments.map((d) => (
              <Link
                key={d.id}
                href="/departments"
                className="group rounded-xl border border-gray-200/80 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-[#1e293b] dark:border-white/8"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400">
                  <Icon name="folder" size={18} />
                </span>
                <h3 className="mt-3.5 truncate text-[15px] font-semibold tracking-tight text-ink group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                  {d.name}
                </h3>
                {d.description && (
                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-sub dark:text-slate-400">
                    {d.description}
                  </p>
                )}
                <div className="mt-3.5 flex items-center gap-3 border-t border-gray-100 pt-3.5 text-[12px] text-faint dark:border-white/8 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Icon name="members" size={12} />
                    {d._count.members} members
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Icon name="calendar" size={12} />
                    {d._count.events} events
                  </span>
                </div>
                {d.coordinator && (
                  <p className="mt-2.5 flex min-w-0 items-center gap-1.5 text-[12px] text-sub dark:text-slate-400">
                    <Icon name="user" size={11} className="shrink-0 text-faint" />
                    <span className="truncate">
                      Coordinated by {d.coordinator.user.name}
                    </span>
                  </p>
                )}
              </Link>
            ))}
          </Grid>
        </Container>
      ) : null}

      {/* ---------- CTA ---------- */}
      <Container size="page" className="pb-24">
        <div className="dark-band relative overflow-hidden rounded-2xl px-6 py-14 text-center shadow-pop sm:px-12">
          <h2 className="gold-text font-display relative text-[26px] font-bold tracking-tight sm:text-[32px]">
            Ready to take the stage?
          </h2>
          <p className="relative mx-auto mt-2 max-w-xl text-[14px] leading-relaxed text-slate-300/80 dark:text-slate-300/80">
            Registration windows open every semester. Sign up, audition, and become part of the
            story.
          </p>
          <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/recruitment"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-[14px] font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] shadow-sm"
            >
              Apply Now
              <Icon name="arrow-right" size={14} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-10 items-center rounded-xl border border-white/20 px-5 text-[14px] font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  link,
}: {
  eyebrow: string;
  title: string;
  link: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="theatre-eyebrow text-accent">{eyebrow}</p>
        <h2 className="font-display mt-2.5 text-[24px] font-bold tracking-tight text-ink sm:text-[28px] dark:text-slate-100">
          {title}
        </h2>
      </div>
      <Link
        href={link.href}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-ink backdrop-blur transition hover:bg-gray-50 dark:bg-white/5 dark:text-slate-100 dark:border-white/10 dark:hover:bg-white/10",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        )}
      >
        {link.label}
        <Icon name="chevron-right" size={13} />
      </Link>
    </div>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
