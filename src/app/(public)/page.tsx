import Link from "next/link";
import { publicFetch } from "@/lib/server";
import type { PublicAbout, PublicHomeData } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Container, Grid } from "@/components/ui/layout";
import { cn } from "@/lib/cn";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const [about, home] = await Promise.all([
    publicFetch<PublicAbout>("/api/public/about"),
    publicFetch<PublicHomeData>("/api/public/home"),
  ]);

  const clubName = about?.clubName || "Drama Club";
  const description =
    about?.clubDescription ||
    "Where passion meets the stage — join a community of storytellers, performers and creators.";

  return (
    <div className="dark:bg-black">
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(1200px 500px at 50% -10%, rgba(0,113,227,0.14), transparent 60%), radial-gradient(800px 400px at 85% 0%, rgba(175,82,222,0.1), transparent 55%)",
          }}
        />
        <Container size="page" className="relative flex min-h-[72dvh] flex-col items-center justify-center pt-20 pb-16 text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-4 py-2 text-[13px] font-medium text-sub backdrop-blur dark:bg-white/10 dark:text-gray-300">
            <Icon name="sparkles" size={14} className="text-accent" aria-hidden="true" />
            {about?.activeMemberCount != null && (
              <span>
                {about.activeMemberCount} active members
                {about.departmentCount != null ? ` · ${about.departmentCount} departments` : ""}
              </span>
            )}
          </span>
          <h1 className="display-title max-w-4xl text-ink dark:text-gray-50">
            {clubName}
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-sub sm:text-[19px] dark:text-gray-400">
            {description}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/recruitment"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-base font-medium text-white shadow-[0_2px_4px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,113,227,0.3)] transition hover:bg-accent-hover active:scale-[0.98]"
            >
              Join the Club
              <Icon name="arrow-right" size={16} />
            </Link>
            <Link
              href="/productions"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-white/80 px-7 text-base font-medium text-ink backdrop-blur transition hover:bg-white active:scale-[0.98] dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/20"
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
                className="flex items-center gap-3.5 rounded-apple border border-line bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover dark:bg-[#1c1c1e] dark:border-white/10"
              >
                <Avatar name={mr.member.user.name} src={mr.member.user.image} size={44} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink dark:text-gray-100">
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
                className="group flex flex-col rounded-apple border border-line bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-[#1c1c1e] dark:border-white/10"
              >
                <div className="flex items-center justify-between">
                  <StatusPill value={u.category} />
                  <span className="text-[12px] text-faint">{formatDate(u.publishedAt)}</span>
                </div>
                <h3 className="mt-3 line-clamp-2 text-[16.5px] font-semibold tracking-tight text-ink group-hover:text-accent dark:text-gray-100">
                  {u.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-sub dark:text-gray-400">
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
                className="flex flex-wrap items-center gap-4 rounded-apple border border-line bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover sm:px-5 dark:bg-[#1c1c1e] dark:border-white/10"
              >
                <div className="flex min-w-[64px] flex-col items-center rounded-xl bg-accent-soft px-3 py-2 text-accent">
                  <span className="text-[18px] font-bold leading-none">
                    {new Date(e.startAt).getDate()}
                  </span>
                  <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide">
                    {new Date(e.startAt).toLocaleString(undefined, { month: "short" })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-semibold text-ink dark:text-gray-100">
                    {e.title}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-sub dark:text-gray-400">
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
            eyebrow="Behind Every Curtain"
            title="Our Departments"
            link={{ href: "/departments", label: "All departments" }}
          />
          <Grid preset="cards" className="mt-8">
            {home.departments.map((d) => (
              <Link
                key={d.id}
                href="/departments"
                className="group rounded-apple border border-line bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-[#1c1c1e] dark:border-white/10"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-purple/10 text-purple">
                  <Icon name="folder" size={20} />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold tracking-tight text-ink group-hover:text-accent dark:text-gray-100">
                  {d.name}
                </h3>
                {d.description && (
                  <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-sub dark:text-gray-400">
                    {d.description}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-3 text-[12.5px] text-faint">
                  <span>{d._count.members} members</span>
                  <span>·</span>
                  <span>{d._count.events} events</span>
                  {d.coordinator && (
                    <>
                      <span>·</span>
                      <span className="truncate text-sub">
                        Coordinated by {d.coordinator.user.name}
                      </span>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </Grid>
        </Container>
      ) : null}

      {/* ---------- CTA ---------- */}
      <Container size="page" className="pb-24">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-accent to-indigo px-6 py-14 text-center shadow-pop sm:px-12">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(600px 300px at 80% 0%, rgba(255,255,255,0.25), transparent 60%)",
            }}
          />
          <h2 className="relative text-[26px] font-bold tracking-tight text-white sm:text-[32px]">
            Ready to take the stage?
          </h2>
          <p className="relative mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-white/80">
            Registration windows open every semester. Sign up, audition, and become part of the
            story.
          </p>
          <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/recruitment"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-accent shadow-lg transition hover:bg-gray-50 active:scale-[0.98]"
            >
              Apply Now
              <Icon name="arrow-right" size={15} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center rounded-full border border-white/40 px-6 text-[15px] font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]"
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
        <p className="text-[13px] font-semibold uppercase tracking-widest text-accent">
          {eyebrow}
        </p>
        <h2 className="mt-1.5 text-[24px] font-bold tracking-tight text-ink sm:text-[30px] dark:text-gray-100">
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
