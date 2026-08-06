import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST as CONTACT_POST } from "@/app/api/contact/route";
import { GET as DASH_ADMIN_GET } from "@/app/api/dashboard/admin/route";
import { GET as DASH_MEMBER_GET } from "@/app/api/dashboard/member/route";
import { GET as EVENTS_GET, POST as EVENTS_POST } from "@/app/api/events/route";
import { PATCH as EVENT_PATCH, DELETE as EVENT_DELETE } from "@/app/api/events/[id]/route";
import { POST as MEMBERS_POST } from "@/app/api/members/route";
import { PATCH as MEMBER_PATCH } from "@/app/api/members/[id]/route";
import { PATCH as SETTINGS_PATCH } from "@/app/api/settings/route";
import { PATCH as UPDATE_PATCH } from "@/app/api/updates/[id]/route";
import { GET as PUBLIC_EVENTS_GET } from "@/app/api/public/events/route";
import { GET as PUBLIC_PRODUCTIONS_GET } from "@/app/api/public/productions/route";
import { GET as PUBLIC_UPDATES_GET } from "@/app/api/public/updates/route";
import { GET as RW_APPLICANTS_GET } from "@/app/api/registration-windows/[id]/applicants/route";
import {
  GET as APPLICANT_GET,
  PATCH as APPLICANT_PATCH,
} from "@/app/api/applicants/[id]/route";
import {
  mockRequest,
  mockAuth,
  clearAuth,
  cleanupTestData,
  seedPermissions,
  createTestUser,
  createTestMember,
  createTestDepartment,
  createTestCommittee,
  createTestRole,
  assignCommitteeRole,
  assignDepartment,
  getTestPermission,
  NON_EXISTENT_CUID,
  uniqueSuffix,
} from "./helpers";
import prisma from "@/lib/prisma";
import { memberSchema } from "@/lib/validations";
import * as validations from "@/lib/validations";
import { sendEmail } from "@/lib/email";
import {
  notifyDepartmentMembers,
  notifyAllActiveMembers,
} from "@/lib/notifications";
import { POST as COMMITTEES_POST } from "@/app/api/committees/route";
import { PATCH as COMMITTEE_PATCH } from "@/app/api/committees/[id]/route";
import { PATCH as TASK_PATCH } from "@/app/api/departments/[id]/tasks/[taskId]/route";
import { POST as PROMOTION_SUBMIT_POST } from "@/app/api/promotions/[id]/submit/route";
import { POST as PROMOTION_DECISION_POST } from "@/app/api/promotions/[id]/decision/route";
import { POST as RW_POST } from "@/app/api/registration-windows/route";
import { PATCH as RW_ONE_PATCH } from "@/app/api/registration-windows/[id]/route";
import { POST as CONVERT_POST } from "@/app/api/applicants/[id]/convert/route";
import { GET as APPLICANTS_EXPORT_GET } from "@/app/api/applicants/export/route";
import { POST as REGISTER_POST } from "@/app/api/auth/register/route";
import { POST as UPDATES_POST } from "@/app/api/updates/route";
import { PATCH as RW_ONE_APPLICANT_PATCH } from "@/app/api/registration-windows/[id]/applicants/[applicantId]/route";

async function setupUser(permissions: string[]) {
  const user = await createTestUser();
  const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
  const cmt = await createTestCommitteeCompat();
  const permIds = (
    await prisma.permission.findMany({ where: { key: { in: permissions } } })
  ).map((p) => p.id);
  const role = await createTestRole({ name: `FG-${uniqueSuffix()}`, permissionIds: permIds });
  await assignCommitteeRole(member.id, role.id, cmt.id);
  mockAuth(user.user.id, permissions);

  return { user: user.user, member, cmt, role };
}

async function createTestCommitteeCompat() {
  const suffix = uniqueSuffix();
  return prisma.committee.create({
    data: {
      year: `202${suffix.slice(-1)}`,
      startDate: new Date("2024-01-01"),
      isCurrent: true,
      status: "ACTIVE",
    },
  });
}

let sharedDepartmentId: string | null = null;

function departmentId(): string {
  if (!sharedDepartmentId) {
    throw new Error("departmentId() called before it was set");
  }
  return sharedDepartmentId;
}

beforeEach(async () => {
  await cleanupTestData();
  await seedPermissions();
  clearAuth();
  sharedDepartmentId = (await createTestDepartment({})).id;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Lib helpers & schemas remaining branches", () => {
  it("getTestPermission returns the seeded permission", async () => {
    const perm = await getTestPermission("member.view");
    expect(perm?.key).toBe("member.view");
  });

  it("memberSchema rejects an invalid dateOfBirth", () => {
    const res = memberSchema.safeParse({
      userId: NON_EXISTENT_CUID,
      memberCode: "M9",
      dateOfBirth: "not-a-date",
    });
    expect(res.success).toBe(false);
  });

  it("prisma client factory throws when DATABASE_URL is missing", async () => {
    const savedUrl = process.env.DATABASE_URL;
    const savedGlobal = (globalThis as { prisma?: unknown }).prisma;
    delete process.env.DATABASE_URL;
    (globalThis as { prisma?: unknown }).prisma = undefined;
    await expect(import(`@/lib/prisma?fresh=${Date.now()}`)).rejects.toThrow("DATABASE_URL");
    process.env.DATABASE_URL = savedUrl;
    (globalThis as { prisma?: unknown }).prisma = savedGlobal;
  });
});

describe("Email lib remaining branches", () => {
  it("sendEmail returns false when override reset and no API key configured", async () => {
    const real = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
    const email = await import("@/lib/email");
    vi.mocked(email.sendEmail).mockImplementation(real.sendEmail);
    vi.mocked(email._setResendForTesting).mockImplementation(real._setResendForTesting);
    vi.stubEnv("RESEND_API_KEY", "");
    email._setResendForTesting(undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await email.sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(result).toBe(false);
    expect(logSpy).toHaveBeenCalled();
    email._setResendForTesting(undefined);
    logSpy.mockRestore();
  });

  it("sendEmail passes EMAIL_FROM when set", async () => {
    const real = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
    const email = await import("@/lib/email");
    vi.mocked(email.sendEmail).mockImplementation(real.sendEmail);
    vi.mocked(email._setResendForTesting).mockImplementation(real._setResendForTesting);
    vi.stubEnv("EMAIL_FROM", "club@dcms.test");
    const send = vi.fn().mockResolvedValue({ id: "1" });
    email._setResendForTesting({ emails: { send } } as never);
    const result = await email.sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(result).toBe(true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: "club@dcms.test" }));
    email._setResendForTesting(undefined);
  });
});

describe("Notifications lib real implementation", () => {
  it("createNotification swallows database errors", async () => {
    const real = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
    const notif = await import("@/lib/notifications");
    vi.mocked(notif.createNotification).mockImplementation(real.createNotification);
    const u = await createTestUser();
    const spy = vi.spyOn(prisma.notification, "create").mockRejectedValueOnce(new Error("boom"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await notif.createNotification({ userId: u.user.id, type: "GENERAL", title: "T", message: "M" });
    expect(consoleSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("notifyDepartmentMembers notifies members + coordinator and honors excludeUserId", async () => {
    const real = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
    const notif = await import("@/lib/notifications");
    vi.mocked(notif.notifyDepartmentMembers).mockImplementation(real.notifyDepartmentMembers);
    const ua = await createTestUser();
    const ma = await createTestMember({ userId: ua.user.id, status: "ACTIVE" });
    const ub = await createTestUser();
    const mb = await createTestMember({ userId: ub.user.id, status: "ACTIVE" });
    const uc = await createTestUser();
    const mc = await createTestMember({ userId: uc.user.id, status: "ACTIVE" });
    const dept = await prisma.department.create({
      data: { name: `N-${uniqueSuffix()}`, committeeId: (await createTestCommitteeCompat()).id, coordinatorId: mc.id },
    });
    await assignDepartment(ma.id, dept.id);
    await assignDepartment(mb.id, dept.id);

    await notif.notifyDepartmentMembers({
      departmentId: dept.id,
      type: "EVENT",
      title: "T",
      message: "M",
      excludeUserId: uc.user.id,
      payload: { source: "test" },
    });

    const created = await prisma.notification.findMany({ where: { type: "EVENT" } });
    const userIds = created.map((n) => n.userId).sort();
    expect(userIds).toEqual([ua.user.id, ub.user.id].sort());
  });

  it("notifyDepartmentMembers returns early when nobody to notify", async () => {
    const real = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
    const notif = await import("@/lib/notifications");
    vi.mocked(notif.notifyDepartmentMembers).mockImplementation(real.notifyDepartmentMembers);
    await notif.notifyDepartmentMembers({
      departmentId: NON_EXISTENT_CUID,
      type: "EVENT",
      title: "T",
      message: "M",
    });
    const created = await prisma.notification.findMany({ where: { type: "EVENT" } });
    expect(created).toEqual([]);
  });

  it("notifyDepartmentMembers swallows database errors", async () => {
    const real = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
    const notif = await import("@/lib/notifications");
    vi.mocked(notif.notifyDepartmentMembers).mockImplementation(real.notifyDepartmentMembers);
    const spy = vi.spyOn(prisma.memberDepartment, "findMany").mockRejectedValueOnce(new Error("boom"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await notif.notifyDepartmentMembers({
      departmentId: NON_EXISTENT_CUID,
      type: "EVENT",
      title: "T",
      message: "M",
    });
    expect(consoleSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("notifyAllActiveMembers notifies only ACTIVE members and honors excludeUserId", async () => {
    const real = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
    const notif = await import("@/lib/notifications");
    vi.mocked(notif.notifyAllActiveMembers).mockImplementation(real.notifyAllActiveMembers);
    const ua = await createTestUser();
    await createTestMember({ userId: ua.user.id, status: "ACTIVE" });
    const ub = await createTestUser();
    await createTestMember({ userId: ub.user.id, status: "ACTIVE" });
    const uc = await createTestUser();
    await createTestMember({ userId: uc.user.id, status: "INACTIVE" });

    await notif.notifyAllActiveMembers({
      type: "ANNOUNCEMENT",
      title: "T",
      message: "M",
      excludeUserId: ub.user.id,
    });

    const created = await prisma.notification.findMany({ where: { type: "ANNOUNCEMENT" } });
    expect(created.map((n) => n.userId)).toEqual([ua.user.id]);
  });

  it("notifyAllActiveMembers returns early when no active members", async () => {
    const real = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
    const notif = await import("@/lib/notifications");
    vi.mocked(notif.notifyAllActiveMembers).mockImplementation(real.notifyAllActiveMembers);
    await notif.notifyAllActiveMembers({ type: "ANNOUNCEMENT", title: "T", message: "M" });
    const created = await prisma.notification.findMany({ where: { type: "ANNOUNCEMENT" } });
    expect(created).toEqual([]);
  });

  it("notifyAllActiveMembers swallows database errors", async () => {
    const real = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
    const notif = await import("@/lib/notifications");
    vi.mocked(notif.notifyAllActiveMembers).mockImplementation(real.notifyAllActiveMembers);
    const spy = vi.spyOn(prisma.member, "findMany").mockRejectedValueOnce(new Error("boom"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await notif.notifyAllActiveMembers({ type: "ANNOUNCEMENT", title: "T", message: "M" });
    expect(consoleSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Route remaining branches", () => {
  it("contact returns 500 on database failure", async () => {
    const spy = vi.spyOn(prisma.contactSubmission, "create").mockRejectedValueOnce(new Error("boom"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await CONTACT_POST(
      mockRequest("/api/contact", {
        method: "POST",
        body: { name: "X", email: `c-${uniqueSuffix()}@test.com`, message: "This is a long enough message" },
        headers: { "x-forwarded-for": `90.1.${Math.floor(Math.random() * 200) + 1}.1` },
      })
    );
    expect(res.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("admin dashboard computes conversion rates", async () => {
    const s = await setupUser(["permissions.manage"]);
    void s;
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    await prisma.applicant.createMany({
      data: [
        { registrationWindowId: rw.id, name: "A1", email: `x1-${uniqueSuffix()}@test.com`, phone: "1", studentId: "S1", departmentPrefs: [], status: "ACCEPTED" },
        { registrationWindowId: rw.id, name: "A2", email: `x2-${uniqueSuffix()}@test.com`, phone: "2", studentId: "S2", departmentPrefs: [], status: "SUBMITTED" },
      ],
    });
    const res = await DASH_ADMIN_GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.registrations[0].applicantCount).toBe(2);
    expect(data.registrations[0].conversionCount).toBe(1);
    expect(data.registrations[0].conversionRate).toBe(50);
  });

  it("member dashboard returns null role for member without committee role", async () => {
    const u = await createTestUser();
    const m = await createTestMember({ userId: u.user.id, status: "ACTIVE" });
    const dept = await createTestDepartment({});
    await assignDepartment(m.id, dept.id);
    mockAuth(u.user.id);
    const res = await DASH_MEMBER_GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.member.currentRole).toBeNull();
    expect(data.member.committee).toBeNull();
    expect(data.departments).toHaveLength(1);
  });

  it("events GET filters by type and departmentId", async () => {
    await prisma.event.create({
      data: { title: "E", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2027-01-01"), departmentId: departmentId() },
    });
    const res = await EVENTS_GET(
      mockRequest("/api/events", { searchParams: { type: "WORKSHOP", departmentId: departmentId(), upcoming: "true" } })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.events).toHaveLength(1);
    expect(data.events[0].title).toBe("E");
  });

  it("events POST with endAt and department notifies department members", async () => {
    await setupUser(["events.manage"]);
    const res = await EVENTS_POST(
      mockRequest("/api/events", {
        method: "POST",
        body: { title: "E", type: "WORKSHOP", startAt: "2026-01-01T00:00:00.000Z", endAt: "2026-02-01T00:00:00.000Z", departmentId: departmentId() },
      })
    );
    expect(res.status).toBe(201);
    expect(notifyDepartmentMembers).toHaveBeenCalled();
  });

  it("events POST without department notifies all active members", async () => {
    await setupUser(["events.manage"]);
    const res = await EVENTS_POST(
      mockRequest("/api/events", {
        method: "POST",
        body: { title: "E", type: "REHEARSAL", startAt: "2026-01-01T00:00:00.000Z" },
      })
    );
    expect(res.status).toBe(201);
    expect(notifyAllActiveMembers).toHaveBeenCalled();
  });

  it("event PATCH returns 400 on invalid status", async () => {
    await setupUser(["events.manage"]);
    const ev = await prisma.event.create({
      data: { title: "E", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2026-01-01") },
    });
    const res = await EVENT_PATCH(
      mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { status: "BOGUS" } }),
      { params: Promise.resolve({ id: ev.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("event PATCH without department still succeeds when notifyAll fails", async () => {
    await setupUser(["events.manage"]);
    const ev = await prisma.event.create({
      data: { title: "E", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2026-01-01") },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(notifyAllActiveMembers).mockRejectedValueOnce(new Error("boom"));
    const res = await EVENT_PATCH(
      mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { title: "Renamed" } }),
      { params: Promise.resolve({ id: ev.id }) }
    );
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("event DELETE without department still succeeds when notifyAll fails", async () => {
    await setupUser(["events.manage"]);
    const ev = await prisma.event.create({
      data: { title: "E", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2026-01-01") },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(notifyAllActiveMembers).mockRejectedValueOnce(new Error("boom"));
    const res = await EVENT_DELETE(
      mockRequest(`/api/events/${ev.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: ev.id }) }
    );
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("members POST stores dateOfBirth", async () => {
    await setupUser(["member.create"]);
    const u = await createTestUser();
    const res = await MEMBERS_POST(
      mockRequest("/api/members", {
        method: "POST",
        body: { userId: u.user.id, memberCode: `DOB-${uniqueSuffix()}`, dateOfBirth: "2000-01-01", phone: "123" },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(new Date(data.dateOfBirth).getUTCFullYear()).toBe(2000);
  });

  it("member PATCH updates dateOfBirth", async () => {
    await setupUser(["member.edit"]);
    const u = await createTestUser();
    const m = await createTestMember({ userId: u.user.id });
    const res = await MEMBER_PATCH(
      mockRequest(`/api/members/${m.id}`, { method: "PATCH", body: { dateOfBirth: "1999-05-05" } }),
      { params: Promise.resolve({ id: m.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(new Date(data.dateOfBirth).getUTCFullYear()).toBe(1999);
  });

  it("settings PATCH rejects unknown keys after schema bypass", async () => {
    await setupUser(["settings.manage"]);
    const validations = await import("@/lib/validations");
    const spy = vi
      .spyOn(validations, "settingsSchema", "get")
      .mockReturnValue({ parse: (b: unknown) => b } as never);
    const res = await SETTINGS_PATCH(
      mockRequest("/api/settings", { method: "PATCH", body: { evilKey: "x" } })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid setting keys");
    spy.mockRestore();
  });

  it("update PATCH returns 400 on invalid category", async () => {
    await setupUser(["updates.publish"]);
    const res = await UPDATE_PATCH(
      mockRequest("/api/updates/x", { method: "PATCH", body: { category: "BOGUS" } }),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(400);
  });

  it("public/events handles NaN and oversized limits", async () => {
    const res1 = await PUBLIC_EVENTS_GET(mockRequest("/api/public/events", { searchParams: { limit: "abc" } }));
    expect(res1.status).toBe(200);
    const res2 = await PUBLIC_EVENTS_GET(mockRequest("/api/public/events", { searchParams: { limit: "999" } }));
    expect(res2.status).toBe(200);
  });

  it("public/productions handles NaN limit", async () => {
    const res = await PUBLIC_PRODUCTIONS_GET(mockRequest("/api/public/productions", { searchParams: { limit: "abc" } }));
    expect(res.status).toBe(200);
  });

  it("public/updates handles NaN and oversized limits", async () => {
    const res1 = await PUBLIC_UPDATES_GET(mockRequest("/api/public/updates", { searchParams: { limit: "abc" } }));
    expect(res1.status).toBe(200);
    const res2 = await PUBLIC_UPDATES_GET(mockRequest("/api/public/updates", { searchParams: { limit: "999" } }));
    expect(res2.status).toBe(200);
  });

  it("registration-window applicants GET supports status and search filters", async () => {
    await setupUser(["registration.review"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    const email = `rw-${uniqueSuffix()}@test.com`;
    await prisma.applicant.createMany({
      data: [
        { registrationWindowId: rw.id, name: "A1", email, phone: "1", studentId: "S1", departmentPrefs: [], status: "SUBMITTED" },
        { registrationWindowId: rw.id, name: "A2", email: `rw2-${uniqueSuffix()}@test.com`, phone: "2", studentId: "S2", departmentPrefs: [], status: "ACCEPTED" },
      ],
    });
    const res = await RW_APPLICANTS_GET(
      mockRequest(`/api/registration-windows/${rw.id}/applicants`, {
        searchParams: { status: "SUBMITTED", search: "A1" },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applicants).toHaveLength(1);
    expect(data.applicants[0].email).toBe(email);
  });

  it("registration-window applicants GET returns 500 on failure", async () => {
    await setupUser(["registration.review"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    const spy = vi.spyOn(prisma.applicant, "findMany").mockRejectedValueOnce(new Error("boom"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await RW_APPLICANTS_GET(
      mockRequest(`/api/registration-windows/${rw.id}/applicants`),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("applicant GET returns 404 when not found", async () => {
    await setupUser(["registration.review"]);
    const res = await APPLICANT_GET(mockRequest("/api/applicants/x"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("applicant PATCH returns 404 when not found", async () => {
    await setupUser(["registration.review"]);
    const res = await APPLICANT_PATCH(
      mockRequest("/api/applicants/x", { method: "PATCH", body: { status: "ACCEPTED" } }),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("applicant PATCH rejects invalid state transition", async () => {
    await setupUser(["registration.review"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    const app = await prisma.applicant.create({
      data: { registrationWindowId: rw.id, name: "A", email: `tr-${uniqueSuffix()}@test.com`, phone: "1", studentId: "S", departmentPrefs: [], status: "REJECTED" },
    });
    const res = await APPLICANT_PATCH(
      mockRequest(`/api/applicants/${app.id}`, { method: "PATCH", body: { status: "ACCEPTED" } }),
      { params: Promise.resolve({ id: app.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("applicant PATCH REJECTED transition succeeds", async () => {
    await setupUser(["registration.review"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    const app = await prisma.applicant.create({
      data: { registrationWindowId: rw.id, name: "A", email: `rej-${uniqueSuffix()}@test.com`, phone: "1", studentId: "S", departmentPrefs: [], status: "SUBMITTED" },
    });
    const res = await APPLICANT_PATCH(
      mockRequest(`/api/applicants/${app.id}`, { method: "PATCH", body: { status: "REJECTED" } }),
      { params: Promise.resolve({ id: app.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("REJECTED");
  });
});

describe("Branch coverage round 2", () => {
  it("committees POST archives the previous current committee", async () => {
    await setupUser(["committee.manage"]);
    const existing = await prisma.committee.findFirst({ where: { isCurrent: true } });
    expect(existing).not.toBeNull();
    const res = await COMMITTEES_POST(
      mockRequest("/api/committees", {
        method: "POST",
        body: {
          year: `New-${uniqueSuffix()}`,
          startDate: "2026-01-01T00:00:00.000Z",
          endDate: "2027-01-01T00:00:00.000Z",
          isCurrent: true,
        },
      })
    );
    expect(res.status).toBe(201);
    const archived = await prisma.committee.findUnique({ where: { id: existing!.id } });
    expect(archived!.isCurrent).toBe(false);
    expect(archived!.endDate).not.toBeNull();
  });

  it("committees PATCH archives other current committees when promoted", async () => {
    await setupUser(["committee.manage"]);
    const other = await createTestCommittee({ isCurrent: true, year: `Old-${uniqueSuffix()}` });
    const target = await createTestCommittee({ isCurrent: true, year: `New-${uniqueSuffix()}` });
    const res = await COMMITTEE_PATCH(
      mockRequest(`/api/committees/${target.id}`, {
        method: "PATCH",
        body: {
          startDate: "2026-01-01T00:00:00.000Z",
          endDate: "2027-01-01T00:00:00.000Z",
          isCurrent: true,
        },
      }),
      { params: Promise.resolve({ id: target.id }) }
    );
    expect(res.status).toBe(200);
    const archived = await prisma.committee.findUnique({ where: { id: other.id } });
    expect(archived!.isCurrent).toBe(false);
    expect(archived!.endDate).not.toBeNull();
  });

  it("committees PATCH updates dates without transaction", async () => {
    await setupUser(["committee.manage"]);
    const c = await createTestCommittee({ isCurrent: false, year: `Flat-${uniqueSuffix()}` });
    const res = await COMMITTEE_PATCH(
      mockRequest(`/api/committees/${c.id}`, {
        method: "PATCH",
        body: { startDate: "2026-05-01T00:00:00.000Z", endDate: "2027-05-01T00:00:00.000Z" },
      }),
      { params: Promise.resolve({ id: c.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(new Date(data.startDate).getUTCFullYear()).toBe(2026);
  });

  it("task PATCH updates dueDate", async () => {
    await setupUser(["department.manage"]);
    const task = await prisma.task.create({ data: { departmentId: departmentId(), title: "T" } });
    const res = await TASK_PATCH(
      mockRequest(`/api/departments/${departmentId()}/tasks/${task.id}`, {
        method: "PATCH",
        body: { dueDate: "2027-01-01T00:00:00.000Z" },
      }),
      { params: Promise.resolve({ id: departmentId(), taskId: task.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(new Date(data.dueDate).getUTCFullYear()).toBe(2027);
  });

  it("promotion submit notifies approvers when found", async () => {
    await setupUser(["promotion.approve"]);
    const s1 = await setupUser(["promotion.submit"]);
    const current = await createTestRole({ name: `C-${uniqueSuffix()}` });
    const proposed = await createTestRole({ name: `P-${uniqueSuffix()}` });
    const promo = await prisma.promotionRequest.create({
      data: {
        memberId: s1.member.id,
        currentRoleId: current.id,
        proposedRoleId: proposed.id,
        reason: "Good work",
        submittedById: s1.user.id,
        status: "DRAFT",
      },
    });
    const res = await PROMOTION_SUBMIT_POST(mockRequest(`/api/promotions/${promo.id}/submit`, { method: "POST" }), {
      params: Promise.resolve({ id: promo.id }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("SUBMITTED");
    const notified = await prisma.notification.findMany({ where: { type: "PROMOTION", payload: { path: ["promotionId"], equals: promo.id } } });
    expect(notified.length).toBeGreaterThan(0);
  });

  it("promotion decision skips duplicate role assignment", async () => {
    const s = await setupUser(["promotion.approve"]);
    const subject = await createTestUser();
    const subjectMember = await createTestMember({ userId: subject.user.id, status: "ACTIVE" });
    const current = await createTestRole({ name: `C2-${uniqueSuffix()}` });
    const proposed = await createTestRole({ name: `P2-${uniqueSuffix()}` });
    const currentCmts = await prisma.committee.findMany({ where: { isCurrent: true } });
    for (const c of currentCmts) {
      await assignCommitteeRole(subjectMember.id, proposed.id, c.id);
    }
    const promo = await prisma.promotionRequest.create({
      data: {
        memberId: subjectMember.id,
        currentRoleId: current.id,
        proposedRoleId: proposed.id,
        reason: "Good work",
        submittedById: s.user.id,
        status: "SUBMITTED",
      },
    });
    const res = await PROMOTION_DECISION_POST(
      mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
      { params: Promise.resolve({ id: promo.id }) }
    );
    expect(res.status).toBe(200);
    const count = await prisma.committeeMemberRole.count({
      where: { memberId: subjectMember.id, roleId: proposed.id, endedAt: null },
    });
    expect(count).toBe(currentCmts.length);
  });

  it("registration-window POST preserves status", async () => {
    await setupUser(["registration.manage"]);
    const res = await RW_POST(
      mockRequest("/api/registration-windows", {
        method: "POST",
        body: {
          title: "T",
          description: "d",
          startDate: "2026-01-01T00:00:00.000Z",
          endDate: "2026-06-01T00:00:00.000Z",
          status: "SCHEDULED",
        },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe("SCHEDULED");
  });

  it("registration-window POST rejects endDate on or before startDate", async () => {
    await setupUser(["registration.manage"]);
    const res = await RW_POST(
      mockRequest("/api/registration-windows", {
        method: "POST",
        body: {
          title: "T",
          description: "d",
          startDate: "2026-01-01T00:00:00.000Z",
          endDate: "2026-01-01T00:00:00.000Z",
        },
      })
    );
    expect(res.status).toBe(400);
  });

  it("registration-window PATCH updates dates", async () => {
    await setupUser(["registration.manage"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2026-01-01"), endDate: new Date("2026-06-01"), status: "DRAFT" },
    });
    const res = await RW_ONE_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}`, {
        method: "PATCH",
        body: { startDate: "2026-02-01T00:00:00.000Z", endDate: "2026-07-01T00:00:00.000Z" },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(200);
  });

  it("convert assigns preferred departments", async () => {
    await setupUser(["member.create"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    const app = await prisma.applicant.create({
      data: {
        registrationWindowId: rw.id,
        name: "A",
        email: `cv-${uniqueSuffix()}@test.com`,
        phone: "1",
        studentId: "S",
        departmentPrefs: [departmentId()],
        status: "ACCEPTED",
      },
    });
    const res = await CONVERT_POST(mockRequest(`/api/applicants/${app.id}/convert`, { method: "POST", body: {} }), {
      params: Promise.resolve({ id: app.id }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.member.id).toBeTruthy();
    const assigned = await prisma.memberDepartment.findMany({
      where: { memberId: data.member.id, departmentId: departmentId() },
    });
    expect(assigned).toHaveLength(1);
  });

  it("export handles applicant without skills", async () => {
    await setupUser(["registration.review"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    const email = `ex-${uniqueSuffix()}@test.com`;
    await prisma.applicant.create({
      data: {
        registrationWindowId: rw.id,
        name: "A",
        email,
        phone: "1",
        studentId: "S",
        departmentPrefs: [],
        status: "SUBMITTED",
      },
    });
    const res = await APPLICANTS_EXPORT_GET(mockRequest("/api/applicants/export", { searchParams: { windowId: rw.id } }));
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain(email);
  });

  it("register falls back to unknown IP", async () => {
    const res = await REGISTER_POST(
      mockRequest("/api/auth/register", {
        method: "POST",
        body: { name: "X", email: `nip-${uniqueSuffix()}@test.com`, password: "password123" },
      })
    );
    expect(res.status).toBe(201);
  });

  it("update PATCH on draft does not notify", async () => {
    const s = await setupUser(["updates.publish"]);
    const update = await prisma.clubUpdate.create({
      data: { title: "Draft", bodyRichText: "x", category: "ANNOUNCEMENT", authorId: s.user.id },
    });
    vi.mocked(notifyAllActiveMembers).mockClear();
    const res = await UPDATE_PATCH(
      mockRequest(`/api/updates/${update.id}`, { method: "PATCH", body: { title: "Renamed" } }),
      { params: Promise.resolve({ id: update.id }) }
    );
    expect(res.status).toBe(200);
    expect(notifyAllActiveMembers).not.toHaveBeenCalled();
  });

  it("admin dashboard reports zero conversion without applicants", async () => {
    await setupUser(["permissions.manage"]);
    await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "DRAFT" },
    });
    const res = await DASH_ADMIN_GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.registrations[0].conversionRate).toBe(0);
  });

  it("canAny returns false when user has no member profile", async () => {
    const u = await createTestUser();
    const perms = await import("@/lib/permissions");
    expect(await perms.canAny(u.user.id, ["member.view"])).toBe(false);
    expect(await perms.canAny("", ["member.view"])).toBe(false);
  });

  it("event PATCH returns 404 for nonexistent department", async () => {
    await setupUser(["events.manage"]);
    const ev = await prisma.event.create({
      data: { title: "E", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2027-01-01") },
    });
    const res = await EVENT_PATCH(
      mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { departmentId: NON_EXISTENT_CUID } }),
      { params: Promise.resolve({ id: ev.id }) }
    );
    expect(res.status).toBe(404);
  });

  it("event PATCH reassigns department", async () => {
    await setupUser(["events.manage"]);
    const ev = await prisma.event.create({
      data: { title: "E", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2027-01-01") },
    });
    const res = await EVENT_PATCH(
      mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { departmentId: departmentId() } }),
      { params: Promise.resolve({ id: ev.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.departmentId).toBe(departmentId());
  });

  it("sendEmail constructs Resend from env key", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_123");
    vi.stubEnv("EMAIL_FROM", "");
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: vi.fn().mockResolvedValue({ id: "msg1" }) };
      },
    }));
    vi.doUnmock("@/lib/email");
    vi.resetModules();
    const email = await import("@/lib/email");
    const ok = await email.sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(ok).toBe(true);
  });

  it("r2 builds key URLs without public URL configured", async () => {
    vi.doMock("@aws-sdk/client-s3", () => ({
      S3Client: class {},
      PutObjectCommand: class {},
      GetObjectCommand: class {},
    }));
    vi.doMock("@aws-sdk/s3-request-presigner", () => ({
      getSignedUrl: async () => "https://signed.example",
    }));
    vi.stubEnv("R2_ACCOUNT_ID", "acc");
    vi.stubEnv("R2_ACCESS_KEY_ID", "key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "sec");
    vi.stubEnv("R2_BUCKET_NAME", "bkt");
    vi.stubEnv("R2_PUBLIC_URL", "");
    vi.resetModules();
    const r2 = await import("@/lib/r2");
    const first = await r2.getPresignedUploadUrl("gallery/x.jpg", "image/jpeg");
    expect(first.publicUrl).toBe("/gallery/x.jpg");
    const second = await r2.getPresignedDownloadUrl("gallery/y.jpg");
    expect(second).toBe("https://signed.example");
  });
});

describe("Branch coverage round 3", () => {
  it("convert skips assignment when department prefs are invalid", async () => {
    await setupUser(["member.create"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    const app = await prisma.applicant.create({
      data: {
        registrationWindowId: rw.id,
        name: "A",
        email: `ci-${uniqueSuffix()}@test.com`,
        phone: "1",
        studentId: "S",
        departmentPrefs: [NON_EXISTENT_CUID],
        status: "ACCEPTED",
      },
    });
    const res = await CONVERT_POST(mockRequest(`/api/applicants/${app.id}/convert`, { method: "POST", body: {} }), {
      params: Promise.resolve({ id: app.id }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    const count = await prisma.memberDepartment.count({ where: { memberId: data.member.id } });
    expect(count).toBe(0);
  });

  it("export handles rows without skills or department prefs", async () => {
    await setupUser(["registration.review"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    const spy = vi
      .spyOn(prisma.applicant, "findMany")
      .mockResolvedValueOnce([
        { id: "fake1", name: "A", email: `fx-${uniqueSuffix()}@test.com`, phone: "1", studentId: "S", status: "SUBMITTED", createdAt: new Date() },
      ] as never);
    const res = await APPLICANTS_EXPORT_GET(mockRequest("/api/applicants/export", { searchParams: { windowId: rw.id } }));
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain("A,");
    spy.mockRestore();
  });

  it("committees POST without endDate creates non-current committee", async () => {
    await setupUser(["committee.manage"]);
    const res = await COMMITTEES_POST(
      mockRequest("/api/committees", {
        method: "POST",
        body: { year: `Old-${uniqueSuffix()}`, startDate: "2026-01-01T00:00:00.000Z", isCurrent: false },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.isCurrent).toBe(false);
    expect(data.endDate).toBeNull();
  });

  it("committees POST with endDate creates non-current committee", async () => {
    await setupUser(["committee.manage"]);
    const res = await COMMITTEES_POST(
      mockRequest("/api/committees", {
        method: "POST",
        body: {
          year: `Mid-${uniqueSuffix()}`,
          startDate: "2026-01-01T00:00:00.000Z",
          endDate: "2027-01-01T00:00:00.000Z",
          isCurrent: false,
        },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(new Date(data.endDate).getUTCFullYear()).toBe(2027);
  });

  it("event PATCH falls back to empty transitions for unknown status", async () => {
    await setupUser(["events.manage"]);
    const spy = vi
      .spyOn(prisma.event, "findUnique")
      .mockResolvedValueOnce({ id: "evt9", status: "UNKNOWN_STATUS" } as never);
    const res = await EVENT_PATCH(
      mockRequest(`/api/events/evt9`, { method: "PATCH", body: { status: "UPCOMING" } }),
      { params: Promise.resolve({ id: "evt9" }) }
    );
    expect(res.status).toBe(400);
    spy.mockRestore();
  });

  it("events POST notifies with TBD date when created event has no startAt", async () => {
    await setupUser(["events.manage"]);
    const spy = vi
      .spyOn(prisma.event, "create")
      .mockResolvedValueOnce({ id: "evt1", title: "E", type: "WORKSHOP", startAt: null } as never);
    const res = await EVENTS_POST(
      mockRequest("/api/events", {
        method: "POST",
        body: { title: "E", type: "WORKSHOP", startAt: "2026-01-01T00:00:00.000Z", departmentId: departmentId() },
      })
    );
    expect(res.status).toBe(201);
    expect(notifyDepartmentMembers).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("TBD") }));
    spy.mockRestore();
  });

  it("events POST without department notifies all with TBD date", async () => {
    await setupUser(["events.manage"]);
    const spy = vi
      .spyOn(prisma.event, "create")
      .mockResolvedValueOnce({ id: "evt2", title: "E", type: "REHEARSAL", startAt: null } as never);
    const res = await EVENTS_POST(
      mockRequest("/api/events", {
        method: "POST",
        body: { title: "E", type: "REHEARSAL", startAt: "2026-01-01T00:00:00.000Z" },
      })
    );
    expect(res.status).toBe(201);
    expect(notifyAllActiveMembers).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("TBD") }));
    spy.mockRestore();
  });

  it("event PATCH with startAt and endAt", async () => {
    await setupUser(["events.manage"]);
    const ev = await prisma.event.create({
      data: { title: "E", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2026-01-01") },
    });
    const res = await EVENT_PATCH(
      mockRequest(`/api/events/${ev.id}`, {
        method: "PATCH",
        body: { startAt: "2026-01-01T00:00:00.000Z", endAt: "2026-02-01T00:00:00.000Z" },
      }),
      { params: Promise.resolve({ id: ev.id }) }
    );
    expect(res.status).toBe(200);
  });

  it("promotion submit without approvers skips notifications", async () => {
    const s = await setupUser(["promotion.submit"]);
    const current = await createTestRole({ name: `C3-${uniqueSuffix()}` });
    const proposed = await createTestRole({ name: `P3-${uniqueSuffix()}` });
    const promo = await prisma.promotionRequest.create({
      data: {
        memberId: s.member.id,
        currentRoleId: current.id,
        proposedRoleId: proposed.id,
        reason: "Good work",
        submittedById: s.user.id,
        status: "DRAFT",
      },
    });
    const res = await PROMOTION_SUBMIT_POST(mockRequest(`/api/promotions/${promo.id}/submit`, { method: "POST" }), {
      params: Promise.resolve({ id: promo.id }),
    });
    expect(res.status).toBe(200);
    const count = await prisma.notification.count({ where: { type: "PROMOTION" } });
    expect(count).toBe(0);
  });

  it("updates POST skips notify when created update is unpublished", async () => {
    const s = await setupUser(["updates.publish"]);
    void s;
    const spy = vi
      .spyOn(prisma.clubUpdate, "create")
      .mockResolvedValueOnce({ id: "u1", title: "T", category: "ANNOUNCEMENT" } as never);
    vi.mocked(notifyAllActiveMembers).mockClear();
    const res = await UPDATES_POST(
      mockRequest("/api/updates", { method: "POST", body: { title: "T", bodyRichText: "x", category: "ANNOUNCEMENT" } })
    );
    expect(res.status).toBe(201);
    expect(notifyAllActiveMembers).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("registration-window POST handles missing formSchema", async () => {
    await setupUser(["registration.manage"]);
    const spy = vi
      .spyOn(validations, "registrationWindowSchema", "get")
      .mockReturnValue({
        parse: (body: unknown) => ({ ...(body as object), formSchema: undefined }),
      } as never);
    const res = await RW_POST(
      mockRequest("/api/registration-windows", {
        method: "POST",
        body: { title: "T", description: "d", startDate: "2026-01-01T00:00:00.000Z", endDate: "2026-06-01T00:00:00.000Z" },
      })
    );
    expect(res.status).toBe(201);
    spy.mockRestore();
  });

  it("scoped applicant PATCH sends rejected email and tolerates send failure", async () => {
    await setupUser(["registration.review"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    const app = await prisma.applicant.create({
      data: { registrationWindowId: rw.id, name: "A", email: `sa-${uniqueSuffix()}@test.com`, phone: "1", studentId: "S", departmentPrefs: [], status: "SUBMITTED" },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("boom"));
    const res = await RW_ONE_APPLICANT_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}/applicants/${app.id}`, { method: "PATCH", body: { status: "REJECTED" } }),
      { params: Promise.resolve({ id: rw.id, applicantId: app.id }) }
    );
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("scoped applicant PATCH returns 500 on database failure", async () => {
    await setupUser(["registration.review"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    const app = await prisma.applicant.create({
      data: { registrationWindowId: rw.id, name: "A", email: `s500-${uniqueSuffix()}@test.com`, phone: "1", studentId: "S", departmentPrefs: [], status: "SUBMITTED" },
    });
    const spy = vi.spyOn(prisma.applicant, "update").mockRejectedValueOnce(new Error("boom"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await RW_ONE_APPLICANT_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}/applicants/${app.id}`, { method: "PATCH", body: { status: "ACCEPTED" } }),
      { params: Promise.resolve({ id: rw.id, applicantId: app.id }) }
    );
    expect(res.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleSpy.mockRestore();
  });
});
