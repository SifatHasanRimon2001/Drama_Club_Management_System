import { publicFetchFresh, publicFetch } from "@/lib/server";
import type { PublicAbout, PublicDepartment, RegistrationWindow } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { ApplyForm } from "@/components/apply-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Container } from "@/components/ui/layout";
import { PageIntro } from "@/components/ui/page";

export const metadata = { title: "Recruitment" };

export default async function RecruitmentPage() {
  const [windows, departments, about] = await Promise.all([
    publicFetch<RegistrationWindow[]>("/api/public/recruitment"),
    publicFetch<PublicDepartment[]>("/api/public/departments"),
    publicFetchFresh<PublicAbout>("/api/public/about"),
  ]);

  const deptOptions = (departments || []).map((d) => ({ id: d.id, name: d.name }));
  const registrationEnabled = about?.registrationEnabled !== false;

  return (
    <Container size="narrow" className="pb-24 pt-28">
      <PageIntro
        eyebrow="Join the club"
        title="Recruitment"
        subtitle="We open registration at the start of every semester. If a window is live below, fill out the form and take your first step onto the stage."
      />

      {!registrationEnabled ? (
        <div className="mt-14">
          <EmptyState
            icon="lock"
            title="Registration is currently closed"
            message="The club isn't accepting applications right now. Check back when the next window opens."
          />
        </div>
      ) : !windows || windows.length === 0 ? (
        <div className="mt-14">
          <EmptyState
            icon="megaphone"
            title="Registration is closed right now"
            message="Keep an eye on this page — new registration windows open each semester."
          />
        </div>
      ) : (
        <div className="mt-14 space-y-10">
          {windows.map((w) => {
            const isOpen = new Date(w.startDate) <= new Date() && new Date(w.endDate) >= new Date();
            return (
              <section key={w.id} className="scroll-mt-24">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2.5 text-[22px] font-bold tracking-tight text-ink dark:text-slate-100">
                      {w.title}
                      {isOpen && (
                        <Badge tone="green" dot className="align-middle">
                          Open now
                        </Badge>
                      )}
                    </h2>
                    <p className="mt-1.5 flex items-center gap-2 text-[13.5px] text-sub dark:text-slate-400">
                      <Icon name="calendar" size={14} />
                      {formatDate(w.startDate)} — {formatDate(w.endDate)}
                    </p>
                  </div>
                </div>
                {w.description && (
                  <p className="mb-5 max-w-2xl text-[15px] leading-relaxed text-sub dark:text-slate-400">
                    {w.description}
                  </p>
                )}
                <ApplyForm
                  windowId={w.id}
                  formSchema={w.formSchema || {}}
                  departments={deptOptions}
                />
              </section>
            );
          })}
        </div>
      )}
    </Container>
  );
}
