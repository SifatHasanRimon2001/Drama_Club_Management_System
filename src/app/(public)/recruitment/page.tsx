import { publicFetchFresh, publicFetch } from "@/lib/server";
import type { PublicAbout, PublicDepartment, RegistrationWindow } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { ApplyForm } from "@/components/apply-form";
import { EmptyState } from "@/components/ui/feedback";

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
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6">
      <div className="max-w-3xl">
        <p className="text-[13px] font-semibold uppercase tracking-widest text-accent">
          Join the club
        </p>
        <h1 className="display-title mt-3 text-ink dark:text-gray-50">Recruitment</h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-sub dark:text-gray-400">
          We open registration at the start of every semester. If a window is live below,
          fill out the form and take your first step onto the stage.
        </p>
      </div>

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
                    <h2 className="flex items-center gap-2.5 text-[22px] font-bold tracking-tight text-ink dark:text-gray-100">
                      {w.title}
                      {isOpen && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green/12 px-2.5 py-1 text-[12px] font-semibold text-[#248a3d] dark:text-green-400">
                          <span className="size-1.5 animate-pulse-dot rounded-full bg-current" />
                          Open now
                        </span>
                      )}
                    </h2>
                    <p className="mt-1.5 flex items-center gap-2 text-[13.5px] text-sub dark:text-gray-400">
                      <Icon name="calendar" size={14} />
                      {formatDate(w.startDate)} — {formatDate(w.endDate)}
                    </p>
                  </div>
                </div>
                {w.description && (
                  <p className="mb-5 max-w-2xl text-[15px] leading-relaxed text-sub dark:text-gray-400">
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
    </div>
  );
}
