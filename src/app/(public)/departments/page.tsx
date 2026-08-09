import { publicFetch } from "@/lib/server";
import type { PublicDepartment } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Container, Grid } from "@/components/ui/layout";
import { PageIntro } from "@/components/ui/page";

export const metadata = { title: "Departments" };

const DEPARTMENT_ICONS = ["note", "video", "star", "megaphone", "grid", "camera"] as const;

export default async function DepartmentsPage() {
  const departments = await publicFetch<PublicDepartment[]>("/api/public/departments");

  return (
    <Container size="page" className="pb-24 pt-28">
      <PageIntro
        eyebrow="How we work"
        title="Departments"
        subtitle="Every production is a team effort. Our departments cover everything from script to spotlight, marketing to stage management."
      />

      {!departments || departments.length === 0 ? (
        <div className="mt-14">
          <EmptyState
            icon="grid"
            title="No departments yet"
            message="Departments will appear here once the committee sets them up."
          />
        </div>
      ) : (
        <Grid preset="cards" className="mt-14">
          {departments.map((d, i) => (
            <Card
              key={d.id}
              className="group transition-all hover:-translate-y-1 hover:shadow-card-hover"
            >
              <CardBody className="p-6">
                <div className="flex items-start justify-between">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-purple/10 text-purple transition-transform group-hover:scale-110">
                    <Icon name={DEPARTMENT_ICONS[i % DEPARTMENT_ICONS.length]} size={22} />
                  </span>
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-ink">
                    {d._count.members} member{d._count.members === 1 ? "" : "s"}
                  </span>
                </div>
                <h2 className="mt-5 truncate text-[19px] font-bold tracking-tight text-ink dark:text-slate-100">
                  {d.name}
                </h2>
                {d.description && (
                  <p className="mt-2 text-[14px] leading-relaxed text-sub dark:text-slate-400">
                    {d.description}
                  </p>
                )}
                <div className="mt-5 flex items-center gap-3 border-t border-line pt-4 dark:border-white/10">
                  {d.coordinator ? (
                    <>
                      <Avatar name={d.coordinator.user.name} src={d.coordinator.user.image} size={30} />
                      <p className="min-w-0 truncate text-[13px] text-sub dark:text-slate-400">
                        Coordinated by{" "}
                        <span className="font-medium text-ink dark:text-slate-200">
                          {d.coordinator.user.name}
                        </span>
                      </p>
                    </>
                  ) : (
                    <p className="text-[13px] text-faint">Coordinator to be announced</p>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </Grid>
      )}
    </Container>
  );
}
