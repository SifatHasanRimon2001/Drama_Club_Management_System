import { publicFetch } from "@/lib/server";
import type { Event, PublicAbout, PublicHomeData } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Card, CardBody, CardTitle, CardSubtitle } from "@/components/ui/card";

export const metadata = { title: "About" };

const VALUES = [
  { icon: "sparkles" as const, title: "Creativity", text: "We believe every story deserves to be told, and every artist deserves a stage." },
  { icon: "users" as const, title: "Community", text: "A family of performers, technicians, writers and dreamers who support each other." },
  { icon: "trend" as const, title: "Growth", text: "Workshops, mentorship and hands-on productions help members grow every season." },
  { icon: "heart" as const, title: "Passion", text: "From first rehearsals to final bows, we pour our hearts into every performance." },
];

export default async function AboutPage() {
  const [about, home, productions] = await Promise.all([
    publicFetch<PublicAbout>("/api/public/about"),
    publicFetch<PublicHomeData>("/api/public/home"),
    publicFetch<Event[]>("/api/public/productions?limit=100"),
  ]);

  const clubName = about?.clubName || "Drama Club";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6">
      <div className="max-w-3xl">
        <p className="text-[13px] font-semibold uppercase tracking-widest text-accent">About</p>
        <h1 className="display-title mt-3 text-ink dark:text-gray-50">The stage is our home.</h1>
        <p className="mt-6 text-[17px] leading-relaxed text-sub sm:text-[19px] dark:text-gray-400">
          {about?.clubDescription ||
            `${clubName} is a community of performers, creators and technicians united by a love for live theatre. We produce plays, host workshops, and create space for bold storytelling.`}
        </p>
      </div>

      <div className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Active Members", value: about?.activeMemberCount ?? "—", icon: "members" as const },
          { label: "Departments", value: about?.departmentCount ?? "—", icon: "grid" as const },
          { label: "Productions", value: productions?.length ?? "—", icon: "star" as const },
          { label: "Committee", value: home?.committee?.year ?? "—", icon: "trophy" as const },
        ].map((s) => (
          <Card key={s.label}>
            <CardBody className="p-5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon name={s.icon} size={17} />
              </span>
              <div className="mt-3 text-[26px] font-bold tracking-tight text-ink dark:text-gray-100">
                {s.value}
              </div>
              <p className="text-[13px] text-sub dark:text-gray-400">{s.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <h2 className="mt-20 text-[26px] font-bold tracking-tight text-ink dark:text-gray-100">
        What we stand for
      </h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {VALUES.map((v) => (
          <Card key={v.title}>
            <CardBody>
              <CardTitle>
                <span className="mr-2 inline-flex size-8 items-center justify-center rounded-lg bg-purple/10 text-purple align-middle">
                  <Icon name={v.icon} size={16} />
                </span>
                {v.title}
              </CardTitle>
              <CardSubtitle className="mt-2 leading-relaxed">{v.text}</CardSubtitle>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-20 rounded-[28px] border border-line bg-card p-8 sm:p-12 dark:bg-[#1c1c1e] dark:border-white/10">
        <div className="grid items-center gap-8 sm:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-[24px] font-bold tracking-tight text-ink dark:text-gray-100">
              Want to be part of the story?
            </h2>
            <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-sub dark:text-gray-400">
              New members join at the start of every semester through our recruitment drive.
              No experience required — just bring your enthusiasm.
            </p>
          </div>
          <a
            href="/recruitment"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-[15px] font-medium text-white transition hover:bg-accent-hover active:scale-[0.98]"
          >
            Join Us <Icon name="arrow-right" size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
