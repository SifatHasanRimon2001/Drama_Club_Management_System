import Link from "next/link";
import { publicFetch } from "@/lib/server";
import type { Event, PublicAbout, PublicHomeData } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Card, CardBody, CardTitle, CardSubtitle } from "@/components/ui/card";
import { Container, Grid } from "@/components/ui/layout";
import { PageIntro } from "@/components/ui/page";

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

  const clubName = about?.clubName || "BRAC University Drama Club";

  return (
    <Container size="page" className="pb-24 pt-28">
      <PageIntro
        eyebrow="About"
        title="The stage is our home."
        subtitle={
          about?.clubDescription ||
          `${clubName} is a community of performers, creators and technicians united by a love for live theatre. We produce plays, host workshops, and create space for bold storytelling.`
        }
      />

      <Grid preset="stats" className="mt-16">
        {[
          { label: "Active Members", value: about?.activeMemberCount ?? "—", icon: "members" as const },
          { label: "Departments", value: about?.departmentCount ?? "—", icon: "grid" as const },
          { label: "Productions", value: productions?.length ?? "—", icon: "star" as const },
          { label: "Committee", value: home?.committee?.year ?? "—", icon: "trophy" as const },
        ].map((s) => (
          <Card key={s.label}>
            <CardBody className="p-5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
                <Icon name={s.icon} size={17} />
              </span>
              <div className="mt-3 text-[26px] font-bold tracking-tight text-ink">
                {s.value}
              </div>
              <p className="text-[13px] text-sub">{s.label}</p>
            </CardBody>
          </Card>
        ))}
      </Grid>

      <h2 className="mt-20 text-[26px] font-bold tracking-tight text-ink">
        What we stand for
      </h2>
      <Grid preset="split" className="mt-6">
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
      </Grid>

      <Card className="mt-20 p-8 sm:p-12">
        <div className="grid items-center gap-8 sm:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-[24px] font-bold tracking-tight text-ink">
              Want to be part of the story?
            </h2>
            <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-sub">
              New members join at the start of every semester through our recruitment drive.
              No experience required — just bring your enthusiasm.
            </p>
          </div>
          <Link
            href="/recruitment"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-br from-gold-light via-gold to-[#1e40af] px-7 text-base font-bold text-white shadow-gold transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Join Us <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </Card>
    </Container>
  );
}
