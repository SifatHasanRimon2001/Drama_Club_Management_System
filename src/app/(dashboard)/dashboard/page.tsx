"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type {
  AdminDashboardData,
  DepartmentDashboardData,
  MemberDashboardData,
} from "@/lib/types";
import {
  EVENT_TYPE_ICONS,
  EVENT_TYPE_TONES,
  formatDate,
  formatDateTime,
  membershipStatusLabel,
  timeAgo,
} from "@/lib/format";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { PageLoader, EmptyState } from "@/components/ui/feedback";
import { Grid } from "@/components/ui/layout";
import { useRealtimeRefresh } from "@/lib/client/socket";
import { r2Url } from "@/lib/server";

const MEMBER_TONES: Record<string, string> = {
  ACTIVE: "bg-green/12 text-green dark:bg-green/20 dark:text-green-300",
  PENDING: "bg-orange/12 text-orange dark:bg-orange/20 dark:text-orange-300",
  ALUMNI: "bg-blue/12 text-blue dark:bg-blue/20 dark:text-blue-300",
  INACTIVE: "bg-gray/12 text-sub dark:bg-white/10 dark:text-gray-400",
  SUSPENDED: "bg-red/12 text-red dark:bg-red/20 dark:text-red-300",
};

const ICON_TONES: Record<string, string> = {
  blue: "bg-blue/12 text-blue dark:bg-blue/20 dark:text-blue-300",
  green: "bg-green/12 text-green dark:bg-green/20 dark:text-green-300",
  orange: "bg-orange/12 text-orange dark:bg-orange/20 dark:text-orange-300",
  purple: "bg-purple/12 text-purple dark:bg-purple/20 dark:text-purple-300",
  red: "bg-red/12 text-red dark:bg-red/20 dark:text-red-300",
  teal: "bg-teal/12 text-teal dark:bg-teal/20 dark:text-teal-300",
};

export default function DashboardHomePage() {
  const { user, loading: sessionLoading } = useSession();
  const isAdmin = user?.permissions?.includes("permissions.manage") ?? false;

  const [admin, setAdmin] = useState<AdminDashboardData | null>(null);
  const [member, setMember] = useState<MemberDashboardData | null>(null);
  const [dept, setDept] = useState<DepartmentDashboardData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      if (isAdmin) {
        setAdmin(await apiGet<AdminDashboardData>("/api/dashboard/admin"));
      } else {
        const m = await apiGet<MemberDashboardData>("/api/dashboard/member");
        setMember(m);
        if (m.member && m.departments.length > 0) {
          setDept(
            await apiGet<DepartmentDashboardData>(
              `/api/dashboard/department?departmentId=${m.departments[0].id}`
            )
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!sessionLoading && user) {
      const timer = setTimeout(() => void load(), 0);
      return () => clearTimeout(timer);
    }
  }, [sessionLoading, user, load]);

  // Live: refresh whenever anything on the overview changes in real time.
  useRealtimeRefresh(
    ["Member", "Event", "PromotionRequest", "RegistrationWindow", "Applicant", "GalleryAlbum", "GalleryItem", "Notification", "Department", "Committee", "ClubUpdate"],
    load
  );

  if (sessionLoading || (!admin && !member && !error)) {
    return <PageLoader label="Loading your dashboard…" />;
  }

  if (error) {
    return (
      <EmptyState
        icon="warn"
        title="Couldn't load the dashboard"
        message={error}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (admin) return <AdminView data={admin} />;
  return <MemberView member={member} dept={dept} />;
}

/* ---------------- Admin view ---------------- */

function AdminView({ data }: { data: AdminDashboardData }) {
  const totalActive =
    (data.members.byStatus.ACTIVE || 0) + (data.members.byStatus.PENDING || 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-ink dark:text-gray-100">
          Overview
        </h1>
        <p className="mt-1 text-[14px] text-sub dark:text-gray-400">
          Here&apos;s what&apos;s happening in the club today.
        </p>
      </div>

      {/* Stat cards */}
      <Grid preset="stats">
        <Link href="/dashboard/members">
          <StatCard
            icon="members"
            tone="blue"
            label="Total Members"
            value={data.members.total}
            sub={`${totalActive} active this term`}
          />
        </Link>
        <Link href="/dashboard/registration">
          <StatCard
            icon="megaphone"
            tone="purple"
            label="Registrations"
            value={data.registrations.length}
            sub="recent windows"
          />
        </Link>
        <Link href="/dashboard/promotions">
          <StatCard
            icon="trend"
            tone="orange"
            label="Pending Promotions"
            value={data.pendingPromotions.count}
            sub="awaiting review"
          />
        </Link>
        <Link href="/dashboard/events">
          <StatCard
            icon="calendar"
            tone="green"
            label="Upcoming Events"
            value={data.upcomingEvents.length}
            sub="in the calendar"
          />
        </Link>
      </Grid>

      <Grid preset="dash">
        {/* Members by status */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Members by Status</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {["ACTIVE", "PENDING", "ALUMNI", "INACTIVE", "SUSPENDED"].map((s) => {
                const count = data.members.byStatus[s] || 0;
                const pct = data.members.total
                  ? Math.round((count / data.members.total) * 100)
                  : 0;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "w-20 rounded-full px-2 py-1 text-center text-[11px] font-semibold",
                        MEMBER_TONES[s]
                      )}
                    >
                      {membershipStatusLabel(s)}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[13px] font-semibold tabular-nums text-ink dark:text-gray-200">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Registration stats */}
        <Card className="min-w-0 lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Registration Windows</CardTitle>
            <Link
              href="/dashboard/registration"
              className="flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
            >
              Manage <Icon name="arrow-right" size={14} />
            </Link>
          </CardHeader>
          <CardBody className="space-y-3">
            {data.registrations.length === 0 ? (
              <p className="py-6 text-center text-[13.5px] text-sub dark:text-gray-400">
                No registration windows yet.
              </p>
            ) : (
              data.registrations.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-4 rounded-2xl border border-line bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink dark:text-gray-100">
                      {r.title}
                    </p>
                    <p className="text-[12px] text-sub dark:text-gray-400">
                      {r.applicantCount} applications · {r.conversionCount} converted
                    </p>
                  </div>
                  <div className="w-28">
                    <div className="mb-1 flex items-center justify-between text-[11.5px] font-medium text-sub dark:text-gray-400">
                      <span>Converted</span>
                      <span className="tabular-nums">{r.conversionRate}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-green"
                        style={{ width: `${r.conversionRate}%` }}
                      />
                    </div>
                  </div>
                  <StatusPill value={r.status} />
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </Grid>

      <Grid preset="split">
        {/* Pending promotions */}
        <Card className="min-w-0">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Pending Promotions</CardTitle>
            <Link
              href="/dashboard/promotions"
              className="flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
            >
              Review <Icon name="arrow-right" size={14} />
            </Link>
          </CardHeader>
          <CardBody className="space-y-2">
            {data.pendingPromotions.list.length === 0 ? (
              <p className="py-6 text-center text-[13.5px] text-sub dark:text-gray-400">
                No promotions awaiting review.
              </p>
            ) : (
              data.pendingPromotions.list.map((p) => (
                <Link
                  key={p.id}
                  href="/dashboard/promotions"
                  className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 transition hover:border-accent/40 hover:bg-accent-soft/30 dark:border-white/10 dark:hover:border-accent/40 dark:hover:bg-white/5"
                >
                  <Avatar name={p.member?.user?.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink dark:text-gray-100">
                      {p.member?.user?.name}
                    </p>
                    <p className="truncate text-[12px] text-sub dark:text-gray-400">
                      {p.currentRole?.name ?? "Member"} →{" "}
                      <span className="font-medium text-ink dark:text-gray-200">
                        {p.proposedRole?.name}
                      </span>
                    </p>
                  </div>
                  <span className="text-[12px] text-faint">{timeAgo(p.createdAt)}</span>
                </Link>
              ))
            )}
          </CardBody>
        </Card>

        {/* Upcoming events */}
        <Card className="min-w-0">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Upcoming Events</CardTitle>
            <Link
              href="/dashboard/events"
              className="flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
            >
              Manage <Icon name="arrow-right" size={14} />
            </Link>
          </CardHeader>
          <CardBody className="space-y-2">
            {data.upcomingEvents.length === 0 ? (
              <p className="py-6 text-center text-[13.5px] text-sub dark:text-gray-400">
                No upcoming events scheduled.
              </p>
            ) : (
              data.upcomingEvents.map((ev) => (
                <Link
                  key={ev.id}
                  href="/dashboard/events"
                  className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 transition hover:border-accent/40 hover:bg-accent-soft/30 dark:border-white/10 dark:hover:border-accent/40 dark:hover:bg-white/5"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl",
                      ICON_TONES[EVENT_TYPE_TONES[ev.type] || "blue"]
                    )}
                  >
                    <Icon name={(EVENT_TYPE_ICONS[ev.type] as IconName) || "calendar"} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink dark:text-gray-100">
                      {ev.title}
                    </p>
                    <p className="text-[12px] text-sub dark:text-gray-400">
                      {formatDateTime(ev.startAt)}
                      {ev.department ? ` · ${ev.department.name}` : ""}
                    </p>
                  </div>
                  <StatusPill value={ev.status} />
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      </Grid>

      {/* Recent gallery */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recently Added Media</CardTitle>
          <Link
            href="/dashboard/gallery"
            className="flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
          >
            Gallery <Icon name="arrow-right" size={14} />
          </Link>
        </CardHeader>
        <CardBody>
          <Grid preset="thumbs">
            {data.recentGalleryItems.length === 0 ? (
              <p className="col-span-full py-6 text-center text-[13.5px] text-sub dark:text-gray-400">
                Nothing uploaded yet.
              </p>
            ) : (
              data.recentGalleryItems.map((item) => {
                const src = r2Url(item.r2Key);
                return (
                  <Link
                    key={item.id}
                    href="/dashboard/gallery"
                    className="group overflow-hidden rounded-2xl border border-line bg-white dark:border-white/10"
                  >
                    <div className="aspect-square bg-black/[0.04] dark:bg-white/5">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={item.caption || item.fileName}
                          className="size-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-faint">
                          <Icon name="image" size={22} />
                        </div>
                      )}
                    </div>
                    <p className="truncate px-3 py-2 text-[12px] font-medium text-sub dark:text-gray-400">
                      {item.album?.name ?? item.fileName}
                    </p>
                  </Link>
                );
              })
            )}
          </Grid>
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------- Member / department view ---------------- */

function MemberView({
  member,
  dept,
}: {
  member: MemberDashboardData | null;
  dept: DepartmentDashboardData | null;
}) {
  const isMember = !!member?.member;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-ink dark:text-gray-100">
          Hi, {member?.user?.name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="mt-1 text-[14px] text-sub dark:text-gray-400">
          {isMember
            ? `Member since ${member?.member ? formatDate(member.member.joiningDate) : ""} · ${member?.member?.memberCode}`
            : "Your account isn't linked to a member profile yet."}
        </p>
      </div>

      {isMember ? (
        <Grid preset="stats">
          <StatCard
            icon="role"
            tone="purple"
            label="Current Role"
            value={member?.member?.currentRole?.name ?? "Member"}
            sub={member?.member?.committee?.year ? `${member.member.committee.year} committee` : "Club member"}
          />
          <StatCard
            icon="folder"
            tone="blue"
            label="Departments"
            value={member?.departments.length ?? 0}
            sub="you're a member of"
          />
          <StatCard
            icon="calendar"
            tone="green"
            label="Upcoming Events"
            value={member?.upcomingEvents.length ?? 0}
            sub="for you"
          />
          <StatCard
            icon="bell"
            tone="orange"
            label="Notifications"
            value={member?.recentNotifications.length ?? 0}
            sub="recent"
          />
        </Grid>
      ) : (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent dark:bg-accent/20">
              <Icon name="user" size={22} />
            </span>
            <p className="text-[15px] font-semibold text-ink dark:text-gray-100">
              No member profile linked
            </p>
            <p className="max-w-sm text-[13.5px] text-sub dark:text-gray-400">
              Ask an administrator to link a member profile to your account to unlock
              member features.
            </p>
          </CardBody>
        </Card>
      )}

      {dept && (
        <DepartmentWidget data={dept} />
      )}

      {member && member.upcomingEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Upcoming Events</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {member.upcomingEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 dark:border-white/10"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    ICON_TONES[EVENT_TYPE_TONES[ev.type] || "blue"]
                  )}
                >
                  <Icon name={(EVENT_TYPE_ICONS[ev.type] as IconName) || "calendar"} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ink dark:text-gray-100">
                    {ev.title}
                  </p>
                  <p className="text-[12px] text-sub dark:text-gray-400">
                    {formatDateTime(ev.startAt)}
                    {ev.location ? ` · ${ev.location}` : ""}
                  </p>
                </div>
                <StatusPill value={ev.status} />
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function DepartmentWidget({ data }: { data: DepartmentDashboardData }) {
  const tasksByStatus = useMemo(
    () => ({
      TODO: data.taskCounts.TODO || 0,
      IN_PROGRESS: data.taskCounts.IN_PROGRESS || 0,
      DONE: data.taskCounts.DONE || 0,
    }),
    [data]
  );
  const openTasks = tasksByStatus.TODO + tasksByStatus.IN_PROGRESS;

  return (
    <div className="space-y-6">
      <Grid preset="stats">
        <StatCard
          icon="folder"
          tone="blue"
          label="Department"
          value={data.department?.name ?? "—"}
          sub="your current department"
        />
        <StatCard
          icon="members"
          tone="green"
          label="Members"
          value={data.memberCount}
          sub="in this department"
        />
        <StatCard
          icon="tasks"
          tone="orange"
          label="Open Tasks"
          value={openTasks}
          sub={`${tasksByStatus.DONE} completed`}
        />
        <StatCard
          icon="megaphone"
          tone="purple"
          label="Recruitment"
          value={data.recruitment.total}
          sub="applicants interested"
        />
      </Grid>

      <Grid preset="split">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {data.tasks.length === 0 ? (
              <p className="py-6 text-center text-[13.5px] text-sub dark:text-gray-400">
                No tasks in this department yet.
              </p>
            ) : (
              data.tasks.slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-2xl border border-line px-4 py-2.5 dark:border-white/10"
                >
                  <Icon
                    name={t.status === "DONE" ? "check" : "tasks"}
                    size={16}
                    className={
                      t.status === "DONE" ? "text-green" : "text-faint"
                    }
                  />
                  <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink dark:text-gray-100">
                    {t.title}
                  </p>
                  {t.assignee && (
                    <span className="flex items-center gap-1.5 text-[12px] text-sub dark:text-gray-400">
                      <Avatar name={t.assignee.user.name} size={18} />
                      {t.assignee.user.name.split(" ")[0]}
                    </span>
                  )}
                  <StatusPill value={t.status} />
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Department Events</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {data.events.length === 0 ? (
              <p className="py-6 text-center text-[13.5px] text-sub dark:text-gray-400">
                No upcoming events for this department.
              </p>
            ) : (
              data.events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 rounded-2xl border border-line px-4 py-2.5 dark:border-white/10"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl bg-blue/12 text-blue dark:bg-blue/20 dark:text-blue-300">
                    <Icon name={(EVENT_TYPE_ICONS[ev.type] as IconName) || "calendar"} size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-ink dark:text-gray-100">
                      {ev.title}
                    </p>
                    <p className="text-[12px] text-sub dark:text-gray-400">
                      {formatDateTime(ev.startAt)}
                    </p>
                  </div>
                  <StatusPill value={ev.status} />
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </Grid>
    </div>
  );
}
