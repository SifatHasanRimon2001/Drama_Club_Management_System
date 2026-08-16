import { publicFetch } from "@/lib/server";
import type { Committee } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Container, Grid } from "@/components/ui/layout";
import { PageIntro } from "@/components/ui/page";

export const metadata = { title: "Committee" };

export default async function CommitteePage() {
  const committee = await publicFetch<Committee>("/api/public/committee");

  if (!committee) {
    return (
      <Container size="form" className="pb-24 pt-28">
        <EmptyState
          icon="trophy"
          title="No active committee yet"
          message="The current committee will be announced soon."
        />
      </Container>
    );
  }

  const roles = new Map<string, typeof committee.memberRoles>();
  for (const mr of committee.memberRoles) {
    if (!mr.endedAt) {
      const list = roles.get(mr.role.name) || [];
      list.push(mr);
      roles.set(mr.role.name, list);
    }
  }
  const entries = [...roles.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <Container size="page" className="pb-24 pt-28">
      <PageIntro
        eyebrow="Leadership"
        title={`Committee ${committee.year}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" size={15} />
              {formatDate(committee.startDate)}
              {committee.endDate ? ` — ${formatDate(committee.endDate)}` : " — Present"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="users" size={15} />
              {committee.memberRoles.filter((m) => !m.endedAt).length} members
            </span>
          </span>
        }
      />

      {entries.length === 0 ? (
        <div className="mt-14">
          <EmptyState
            icon="users"
            title="Roles yet to be assigned"
            message="Committee positions for this year will be announced soon."
          />
        </div>
      ) : (
        <div className="mt-14 space-y-12">
          {entries.map(([roleName, members]) => (
            <section key={roleName}>
              <h2 className="flex items-center gap-2.5 text-[20px] font-bold tracking-tight text-ink">
                <span className="h-5 w-1 rounded-full bg-accent" />
                {roleName}
              </h2>
              <Grid preset="stats" className="mt-5">
                {members.map((mr) => (
                  <Card key={mr.id}>
                    <CardBody className="flex flex-col items-center px-5 py-7 text-center">
                      <Avatar name={mr.member.user.name} src={mr.member.user.image} size={64} />
                      <p className="mt-4 truncate text-[15.5px] font-semibold text-ink">
                        {mr.member.user.name}
                      </p>
                      <p className="mt-1 text-[13px] text-sub">
                        Member since {formatDate(mr.startedAt).split(",")[0]}
                      </p>
                    </CardBody>
                  </Card>
                ))}
              </Grid>
            </section>
          ))}
        </div>
      )}

      {committee.departments && committee.departments.length > 0 && (
        <div className="mt-20">
          <h2 className="text-[20px] font-bold tracking-tight text-ink">
            Departments in this term
          </h2>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {committee.departments.map((d) => (
              <span
                key={d.id}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] font-medium text-ink shadow-card dark:bg-card dark:border-white/10"
              >
                <Icon name="folder" size={14} className="text-purple" />
                {d.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}
