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
    <div className="dark:bg-black">
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 spotlight" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 vignette" aria-hidden="true" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

        <Container size="page" className="relative flex min-h-[72dvh] flex-col items-center justify-center pt-28 pb-16 text-center">
          <span className="theatre-eyebrow mb-7 text-accent">
            {about?.activeMemberCount != null
              ? `${about.activeMemberCount} members · ${about.departmentCount ?? 0} departments`
              : "Est. Backstage at BRAC"}
          </span>
          <h1 className="display-title animate-rise max-w-4xl text-ink dark:text-[#faf4e6]">
            {clubName}
          </h1>
          <p className="animate-rise mt-6 max-w-2xl text-[17px] leading-relaxed text-sub sm:text-[19px] dark:text-slate-400">
            {description}
          </p>
          <div className="animate-rise mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/recruitment"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-br from-gold-light via-gold to-[#1e40af] px-7 text-base font-bold text-white shadow-gold transition hover:brightness-110 active:scale-[0.98]"
            >
              Join the Club
              <Icon name="arrow-right" size={16} />
            </Link>
            <Link
              href="/productions"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-card/80 px-7 text-base font-semibold text-ink backdrop-blur transition hover:border-accent/50 hover:bg-card active:scale-[0.98] dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20"
            >
              <Icon name="star" size={16} />
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
                className="flex items-center gap-3.5 rounded-apple border border-line bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover dark:bg-[#0f172a] dark:border-white/10"
              >
                <Avatar name={mr.member.user.name} src={mr.member.user.image} size={44} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink dark:text-slate-100">
                    {mr.member.user.name}
                  </p>
                  <p className="truncate text-[13px] text-accent">{mr.role.name}</p>
                </div>
              </div>
            ))}
            {home.committee.memberRoles.length === 0 && (
              <p className="col-span-full text-center text-sm text-sub">
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
                className="group flex flex-col rounded-apple border border-line bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-[#0f172a] dark:border-white/10"
              >
                <div className="flex items-center justify-between">
                  <StatusPill value={u.category} />
                  <span className="text-[12px] text-faint">{formatDate(u.publishedAt)}</span>
                </div>
                <h3 className="mt-3 line-clamp-2 text-[16.5px] font-semibold tracking-tight text-ink group-hover:text-accent dark:text-slate-100">
                  {u.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-sub dark:text-slate-400">
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
                className="flex flex-wrap items-center gap-4 rounded-apple border border-line bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover sm:px-5 dark:bg-[#0f172a] dark:border-white/10"
              >
                <TicketStub
                  date={new Date(e.startAt)}
                  size="sm"
                  className="min-w-[64px]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-semibold text-ink dark:text-slate-100">
                    {e.title}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-sub dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="clock" size={13} />
                      {formatDateTime(e.startAt)}
                    </span>
                    {e.location && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="pin" size={13} />
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
                className="group rounded-apple border border-line bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-[#0f172a] dark:border-white/10"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-purple/10 text-purple">
                  <Icon name="folder" size={20} />
                </span>
                <h3 className="mt-4 truncate text-[17px] font-semibold tracking-tight text-ink group-hover:text-accent dark:text-slate-100">
                  {d.name}
                </h3>
                {d.description && (
                  <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-sub dark:text-slate-400">
                    {d.description}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-3 border-t border-line pt-4 text-[12.5px] text-faint dark:border-white/10 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Icon name="members" size={13} />
                    {d._count.members} members
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Icon name="calendar" size={13} />
                    {d._count.events} events
                  </span>
                </div>
                {d.coordinator && (
                  <p className="mt-3 flex min-w-0 items-center gap-1.5 text-[12.5px] text-sub dark:text-slate-400">
                    <Icon name="user" size={12} className="shrink-0 text-faint" />
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
        <div className="dark-band relative overflow-hidden rounded-[24px] px-6 py-14 text-center shadow-pop sm:px-12">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(600px 300px at 80% 0%, rgba(96,165,250,0.16), transparent 60%)",
            }}
          />
          <h2 className="gold-text font-display relative text-[28px] font-bold tracking-tight sm:text-[34px]">
            Ready to take the stage?
          </h2>
          <p className="relative mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-slate-300/90 dark:text-slate-300/90">
            Registration windows open every semester. Sign up, audition, and become part of the
            story.
          </p>
          <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/recruitment"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-br from-gold-light via-gold to-[#1e40af] px-6 text-[15px] font-bold text-white shadow-gold transition hover:brightness-110 active:scale-[0.98]"
            >
              Apply Now
              <Icon name="arrow-right" size={15} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center rounded-full border border-gold-light/40 px-6 text-[15px] font-bold text-gold-light transition hover:bg-white/10 active:scale-[0.98]"
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
        <h2 className="font-display mt-3 text-[26px] font-bold tracking-tight text-ink sm:text-[32px] dark:text-slate-100">
          {title}
        </h2>
      </div>
      <Link
        href={link.href}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-white/70 px-4 py-2 text-[14px] font-medium text-accent backdrop-blur transition hover:bg-white dark:bg-white/10 dark:hover:bg-white/20",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        )}
      >
        {link.label}
        <Icon name="chevron-right" size={14} />
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
