import Link from "next/link";
import { publicFetch } from "@/lib/server";
import type { PublicAbout, PublicHomeData } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { Icon, type IconName } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Container, Grid } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { AnimatedCounter } from "@/components/ui/counter";
import { TicketStub } from "@/components/ticket-stub";

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

  const memberCount = about?.activeMemberCount ?? 0;
  const departmentCount = about?.departmentCount ?? home?.departments?.length ?? 0;
  const eventCount = home?.upcomingEvents?.length ?? 0;
  const productionCount = home?.recentUpdates?.length ?? 0;

  return (
    <div className="relative">
      {/* ================= Hero ================= */}
      <section className="grain relative isolate overflow-hidden">
        {/* Layered backdrop: drifting aurora, blueprint grid, edge vignette. */}
        <div className="aurora" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 grid-pattern" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 vignette" aria-hidden="true" />

        <Container
          size="page"
          className="relative flex min-h-[88dvh] flex-col items-center justify-center py-28 text-center sm:py-32"
        >
          <Reveal>
            {/* The club name lives here rather than in the headline: it keeps
                the brand present for readers and crawlers while the <h1> stays
                free to say something. Counts are not repeated — the metric
                cards below already carry them. */}
            <span className="inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-card/60 px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-sub backdrop-blur">
              <span className="relative flex size-1.5" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
              </span>
              {clubName}
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="hero-title mt-8 max-w-5xl text-balance text-ink">
              Every great story{" "}
              <span className="gradient-text">starts backstage</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mx-auto mt-7 max-w-2xl text-pretty text-[16.5px] leading-relaxed text-sub sm:text-[18px]">
              {description}
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/recruitment" size="lg" icon="arrow-right" iconTrailing>
                Join the Club
              </ButtonLink>
              <ButtonLink href="/productions" variant="secondary" size="lg" icon="star">
                Our Productions
              </ButtonLink>
            </div>
          </Reveal>

          {/* Floating metric cards — the "dashboard preview" beat, built from
              real counts rather than decorative placeholders. */}
          <Reveal delay={320} className="mt-20 w-full">
            <Grid preset="stats" className="mx-auto max-w-4xl gap-4">
              <HeroMetric icon="members" value={memberCount} label="Active members" />
              <HeroMetric icon="folder" value={departmentCount} label="Departments" />
              <HeroMetric icon="calendar" value={eventCount} label="Upcoming events" />
              <HeroMetric icon="megaphone" value={productionCount} label="Recent updates" />
            </Grid>
          </Reveal>
        </Container>
      </section>

      {/* ================= Committee ================= */}
      {home?.committee ? (
        <Container size="page" className="py-20">
          <Reveal>
            <SectionHeader
              eyebrow="Current Committee"
              title={`Committee ${home.committee.year}`}
              link={{ href: "/committee", label: "View full committee" }}
            />
          </Reveal>
          <Grid preset="stats" className="mt-10 lg:grid-cols-4">
            {home.committee.memberRoles.slice(0, 8).map((mr, i) => (
              <Reveal key={mr.id} delay={Math.min(i * 50, 240)}>
                <div className="card-glow flex h-full items-center gap-3.5 rounded-2xl border border-line bg-card p-4 shadow-card">
                  <Avatar name={mr.member.user.name} src={mr.member.user.image} size={42} />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">
                      {mr.member.user.name}
                    </p>
                    <p className="truncate text-[12.5px] font-medium text-accent-ink">
                      {mr.role.name}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
            {home.committee.memberRoles.length === 0 && (
              <p className="col-span-full text-center text-[13.5px] text-sub">
                Committee roles will be announced soon.
              </p>
            )}
          </Grid>
        </Container>
      ) : null}

      {/* ================= Latest updates ================= */}
      {home?.recentUpdates && home.recentUpdates.length > 0 ? (
        <Container size="page" className="py-12">
          <Reveal>
            <SectionHeader
              eyebrow="Latest News"
              title="Club Updates"
              link={{ href: "/updates", label: "All updates" }}
            />
          </Reveal>
          <Grid preset="cards" className="mt-10">
            {home.recentUpdates.slice(0, 6).map((u, i) => (
              <Reveal key={u.id} delay={Math.min(i * 60, 240)}>
                <Link
                  href={`/updates/${u.id}`}
                  className="card-glow group flex h-full flex-col rounded-2xl border border-line bg-card p-5 shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <div className="flex items-center justify-between gap-3">
                    <StatusPill value={u.category} />
                    <span className="text-[12px] text-faint">{formatDate(u.publishedAt)}</span>
                  </div>
                  <h3 className="mt-4 line-clamp-2 text-[15.5px] font-semibold tracking-[-0.02em] text-ink transition-colors group-hover:text-accent-ink">
                    {u.title}
                  </h3>
                  <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-sub">
                    {stripHtml(u.bodyRichText)}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-ink opacity-0 transition-opacity group-hover:opacity-100">
                    Read more
                    <Icon name="arrow-right" size={12} />
                  </span>
                </Link>
              </Reveal>
            ))}
          </Grid>
        </Container>
      ) : null}

      {/* ================= Upcoming events ================= */}
      {home?.upcomingEvents && home.upcomingEvents.length > 0 ? (
        <Container size="page" className="py-12">
          <Reveal>
            <SectionHeader
              eyebrow="Mark Your Calendar"
              title="Upcoming Events"
              link={{ href: "/events", label: "All events" }}
            />
          </Reveal>
          <div className="mt-10 space-y-3">
            {home.upcomingEvents.map((e, i) => (
              <Reveal key={e.id} delay={Math.min(i * 50, 200)}>
                <Link
                  href={`/events/${e.id}`}
                  className="card-glow flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-card p-4 shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-5"
                >
                  <TicketStub date={new Date(e.startAt)} size="sm" className="min-w-[56px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold text-ink">{e.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-sub">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="clock" size={12} className="text-faint" />
                        {formatDateTime(e.startAt)}
                      </span>
                      {e.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <Icon name="pin" size={12} className="text-faint" />
                          {e.location}
                        </span>
                      )}
                      {e.department && <span className="text-faint">{e.department.name}</span>}
                    </p>
                  </div>
                  <StatusPill value={e.type} />
                </Link>
              </Reveal>
            ))}
          </div>
        </Container>
      ) : null}

      {/* ================= Departments ================= */}
      {home?.departments && home.departments.length > 0 ? (
        <Container size="page" className="py-12 pb-20">
          <Reveal>
            <SectionHeader
              eyebrow="Explore the Crew"
              title="Our Departments"
              link={{ href: "/departments", label: "All departments" }}
            />
          </Reveal>
          <Grid preset="cards" className="mt-10">
            {home.departments.map((d, i) => (
              <Reveal key={d.id} delay={Math.min(i * 50, 240)}>
                <Link
                  href="/departments"
                  className="card-glow group flex h-full flex-col rounded-2xl border border-line bg-card p-5 shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl border border-accent-soft-strong bg-accent-soft text-accent-ink transition-transform duration-300 group-hover:scale-105">
                    <Icon name="folder" size={18} />
                  </span>
                  <h3 className="mt-4 truncate text-[15.5px] font-semibold tracking-[-0.02em] text-ink transition-colors group-hover:text-accent-ink">
                    {d.name}
                  </h3>
                  {d.description && (
                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-sub">
                      {d.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center gap-4 border-t border-line pt-4 text-[12px] text-faint">
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
                    <p className="mt-3 flex min-w-0 items-center gap-1.5 text-[12px] text-sub">
                      <Icon name="user" size={11} className="shrink-0 text-faint" />
                      <span className="truncate">Coordinated by {d.coordinator.user.name}</span>
                    </p>
                  )}
                </Link>
              </Reveal>
            ))}
          </Grid>
        </Container>
      ) : null}

      {/* ================= Closing CTA ================= */}
      <Container size="page" className="pb-28">
        <Reveal>
          <div className="grain relative isolate overflow-hidden rounded-3xl border border-line-strong bg-card px-6 py-16 text-center shadow-pop sm:px-12 sm:py-20">
            <div className="pointer-events-none absolute inset-0 glow-violet" aria-hidden="true" />
            <div
              className="pointer-events-none absolute -bottom-24 left-1/2 size-72 -translate-x-1/2 animate-pulse-glow rounded-full bg-accent/25 blur-[80px]"
              aria-hidden="true"
            />
            <h2 className="font-display relative text-[30px] font-bold tracking-[-0.035em] text-ink sm:text-[40px]">
              Ready to take <span className="gradient-text">the stage?</span>
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-sub">
              Registration windows open every semester. Sign up, audition, and become part of the
              story.
            </p>
            <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/recruitment" size="lg" icon="arrow-right" iconTrailing>
                Apply Now
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary" size="lg">
                Get in Touch
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </Container>
    </div>
  );
}

/** Glass metric tile used in the hero. Counts up once scrolled into view. */
function HeroMetric({
  icon,
  value,
  label,
}: {
  icon: IconName;
  value: number;
  label: string;
}) {
  return (
    <div className="glass edge-glow rounded-2xl border border-line-strong p-5 text-left shadow-card">
      <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
        <Icon name={icon} size={16} />
      </span>
      <div className="mt-4 font-display text-[26px] font-bold leading-none tracking-[-0.03em] text-ink">
        <AnimatedCounter value={value} />
      </div>
      <div className="mt-2 text-[12.5px] font-medium text-sub">{label}</div>
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
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="theatre-eyebrow">{eyebrow}</p>
        <h2 className="font-display mt-3.5 text-[26px] font-bold tracking-[-0.03em] text-ink sm:text-[32px]">
          {title}
        </h2>
      </div>
      <Link
        href={link.href}
        className="group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line-strong bg-card px-4 text-[13px] font-medium text-ink transition-all hover:border-accent hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {link.label}
        <Icon
          name="chevron-right"
          size={13}
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
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
