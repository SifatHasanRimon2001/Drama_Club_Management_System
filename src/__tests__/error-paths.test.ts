import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET as COMMITTEES_GET, POST as COMMITTEES_POST } from "@/app/api/committees/route";
import {
  GET as COMMITTEE_GET,
  PATCH as COMMITTEE_PATCH,
} from "@/app/api/committees/[id]/route";
import {
  POST as COMMITTEE_ROLE_POST,
  DELETE as COMMITTEE_ROLE_DELETE,
} from "@/app/api/committees/[id]/roles/route";
import { GET as PUBLIC_DEPARTMENTS_GET } from "@/app/api/public/departments/route";
import { GET as PUBLIC_RECRUITMENT_GET } from "@/app/api/public/recruitment/route";
import { GET as PUBLIC_ABOUT_GET } from "@/app/api/public/about/route";
import { GET as PUBLIC_COMMITTEE_GET } from "@/app/api/public/committee/route";
import { GET as PUBLIC_HOME_GET } from "@/app/api/public/home/route";
import { GET as PUBLIC_PRODUCTIONS_GET } from "@/app/api/public/productions/route";
import { GET as PUBLIC_EVENTS_GET } from "@/app/api/public/events/route";
import { GET as PUBLIC_GALLERY_GET } from "@/app/api/public/gallery/route";
import { GET as PUBLIC_GALLERY_ONE_GET } from "@/app/api/public/gallery/[id]/route";
import { GET as PUBLIC_UPDATES_GET } from "@/app/api/public/updates/route";
import { GET as SESSION_GET } from "@/app/api/session/route";
import { POST as REGISTER_POST } from "@/app/api/auth/register/route";
import { GET as MEMBERS_GET, POST as MEMBERS_POST } from "@/app/api/members/route";
import { GET as MEMBER_GET, PATCH as MEMBER_PATCH } from "@/app/api/members/[id]/route";
import {
  POST as MEMBER_DEPT_POST,
  DELETE as MEMBER_DEPT_DELETE,
} from "@/app/api/members/[id]/departments/route";
import { GET as DEPARTMENTS_GET, POST as DEPARTMENTS_POST } from "@/app/api/departments/route";
import { GET as DEPARTMENT_GET, PATCH as DEPARTMENT_PATCH } from "@/app/api/departments/[id]/route";
import {
  GET as TASKS_GET,
  POST as TASKS_POST,
} from "@/app/api/departments/[id]/tasks/route";
import {
  PATCH as TASK_PATCH,
  DELETE as TASK_DELETE,
} from "@/app/api/departments/[id]/tasks/[taskId]/route";
import { GET as RW_GET, POST as RW_POST } from "@/app/api/registration-windows/route";
import { GET as RW_ONE_GET, PATCH as RW_ONE_PATCH } from "@/app/api/registration-windows/[id]/route";
import { GET as APPLICANTS_GET } from "@/app/api/applicants/route";
import { GET as APPLICANT_GET, PATCH as APPLICANT_PATCH } from "@/app/api/applicants/[id]/route";
import { GET as APPLICANTS_EXPORT_GET } from "@/app/api/applicants/export/route";
import { POST as CONVERT_POST } from "@/app/api/applicants/[id]/convert/route";
import { GET as PROMOTIONS_GET, POST as PROMOTIONS_POST } from "@/app/api/promotions/route";
import { GET as PROMOTION_GET } from "@/app/api/promotions/[id]/route";
import { POST as PROMOTION_SUBMIT_POST } from "@/app/api/promotions/[id]/submit/route";
import { POST as PROMOTION_DECISION_POST } from "@/app/api/promotions/[id]/decision/route";
import { GET as EVENTS_GET, POST as EVENTS_POST } from "@/app/api/events/route";
import {
  GET as EVENT_GET,
  PATCH as EVENT_PATCH,
  DELETE as EVENT_DELETE,
} from "@/app/api/events/[id]/route";
import { GET as UPDATES_GET, POST as UPDATES_POST } from "@/app/api/updates/route";
import {
  GET as UPDATE_GET,
  PATCH as UPDATE_PATCH,
  DELETE as UPDATE_DELETE,
} from "@/app/api/updates/[id]/route";
import { GET as GALLERY_GET, POST as GALLERY_POST } from "@/app/api/gallery/route";
import { GET as GALLERY_ITEMS_GET, POST as GALLERY_ITEMS_POST } from "@/app/api/gallery/items/route";
import { POST as UPLOAD_URL_POST } from "@/app/api/gallery/upload-url/route";
import { GET as ROLES_GET, POST as ROLES_POST } from "@/app/api/roles/route";
import { GET as ROLE_GET, PATCH as ROLE_PATCH, DELETE as ROLE_DELETE } from "@/app/api/roles/[id]/route";
import { GET as PERMISSIONS_GET, POST as PERMISSIONS_POST } from "@/app/api/permissions/route";
import { GET as SETTINGS_GET, PATCH as SETTINGS_PATCH } from "@/app/api/settings/route";
import { GET as NOTIFICATIONS_GET } from "@/app/api/notifications/route";
import { POST as NOTIFICATION_READ_POST } from "@/app/api/notifications/[id]/read/route";
import { GET as DASH_ADMIN_GET } from "@/app/api/dashboard/admin/route";
import { GET as DASH_DEPT_GET } from "@/app/api/dashboard/department/route";
import { GET as DASH_MEMBER_GET } from "@/app/api/dashboard/member/route";
import { POST as CONTACT_POST } from "@/app/api/contact/route";
import {
  mockRequest,
  mockAuth,
  cleanupTestData,
  seedPermissions,
  createTestUser,
  createTestMember,
  createTestCommittee,
  createTestDepartment,
  createTestRole,
  assignCommitteeRole,
  assignDepartment,
  uniqueSuffix,
} from "./helpers";
import prisma from "@/lib/prisma";
import { sendEmail, applicantStatusEmail } from "@/lib/email";
import {
  notifyDepartmentMembers,
  notifyAllActiveMembers,
  createNotification,
} from "@/lib/notifications";

let admin: { id: string };
let committee: { id: string };
let department: { id: string };

async function setupUser(permissions: string[]) {
  const user = await createTestUser();
  const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
  const cmt = await createTestCommittee({ isCurrent: true });
  const permIds = (
    await prisma.permission.findMany({ where: { key: { in: permissions } } })
  ).map((p) => p.id);
  const role = await createTestRole({ name: `Setup-${uniqueSuffix()}`, permissionIds: permIds });
  await assignCommitteeRole(member.id, role.id, cmt.id);
  mockAuth(user.user.id, permissions);
  return { user: user.user, password: user.password, member, cmt, role };
}

async function makeAdmin(permissions: string[]) {
  const s = await setupUser(permissions);
  admin = s.user;
  committee = s.cmt;
  return s;
}

async function expect500(call: () => Promise<Response>) {
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const res = await call();
  expect(res.status).toBe(500);
  consoleSpy.mockRestore();
  return res;
}

beforeEach(async () => {
  await cleanupTestData();
  await seedPermissions();
  department = await createTestDepartment({});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Committees error & edge paths", () => {
  it("POST creates non-current committee without archiving", async () => {
    await makeAdmin(["committee.manage"]);
    await createTestCommittee({ isCurrent: true, year: "Keep" });

    const res = await COMMITTEES_POST(
      mockRequest("/api/committees", {
        method: "POST",
        body: { year: `NC-${uniqueSuffix()}`, startDate: "2024-01-01T00:00:00.000Z", isCurrent: false },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.isCurrent).toBe(false);

    const kept = await prisma.committee.findFirst({ where: { year: "Keep" } });
    expect(kept!.isCurrent).toBe(true);
  });

  it("POST returns 500 on database failure", async () => {
    await makeAdmin(["committee.manage"]);
    const spy = vi.spyOn(prisma.committee, "create").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      COMMITTEES_POST(
        mockRequest("/api/committees", {
          method: "POST",
          body: { year: "X", startDate: "2024-01-01T00:00:00.000Z", isCurrent: false },
        })
      )
    );
    spy.mockRestore();
  });

  it("GET returns 500 on database failure", async () => {
    await makeAdmin(["committee.manage"]);
    const spy = vi.spyOn(prisma.committee, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => COMMITTEES_GET(mockRequest("/api/committees")));
    spy.mockRestore();
  });

  it("PATCH with isCurrent=true archives other current committees", async () => {
    await makeAdmin(["committee.manage"]);
    const other = await createTestCommittee({ isCurrent: true, year: "OldCurrent" });
    const target = await createTestCommittee({ isCurrent: false, year: "NewCurrent" });

    const res = await COMMITTEE_PATCH(
      mockRequest(`/api/committees/${target.id}`, {
        method: "PATCH",
        body: { isCurrent: true },
      }),
      { params: Promise.resolve({ id: target.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isCurrent).toBe(true);

    const archived = await prisma.committee.findUnique({ where: { id: other.id } });
    expect(archived!.isCurrent).toBe(false);
    expect(archived!.endDate).not.toBeNull();
  });

  it("PATCH returns 400 on invalid body", async () => {
    await makeAdmin(["committee.manage"]);
    const c = await createTestCommittee({});
    const res = await COMMITTEE_PATCH(
      mockRequest(`/api/committees/${c.id}`, { method: "PATCH", body: { year: "" } }),
      { params: Promise.resolve({ id: c.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("PATCH returns 500 on database failure", async () => {
    await makeAdmin(["committee.manage"]);
    const c = await createTestCommittee({});
    const spy = vi.spyOn(prisma.committee, "update").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      COMMITTEE_PATCH(
        mockRequest(`/api/committees/${c.id}`, { method: "PATCH", body: { year: "Y" } }),
        { params: Promise.resolve({ id: c.id }) }
      )
    );
    spy.mockRestore();
  });

  it("GET [id] returns 500 on database failure", async () => {
    const c = await createTestCommittee({});
    const spy = vi.spyOn(prisma.committee, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      COMMITTEE_GET(mockRequest(`/api/committees/${c.id}`), {
        params: Promise.resolve({ id: c.id }),
      })
    );
    spy.mockRestore();
  });

  it("POST roles returns 400 on invalid body", async () => {
    await makeAdmin(["committee.manage"]);
    const res = await COMMITTEE_ROLE_POST(
      mockRequest(`/api/committees/${committee.id}/roles`, {
        method: "POST",
        body: { memberId: "not-a-cuid" },
      }),
      { params: Promise.resolve({ id: committee.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("POST roles returns 500 on database failure", async () => {
    await makeAdmin(["committee.manage"]);
    const u = await createTestUser();
    const m = await createTestMember({ userId: u.user.id });
    const role = await createTestRole({ name: `Role-${uniqueSuffix()}` });
    const spy = vi
      .spyOn(prisma.committeeMemberRole, "create")
      .mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      COMMITTEE_ROLE_POST(
        mockRequest(`/api/committees/${committee.id}/roles`, {
          method: "POST",
          body: { memberId: m.id, roleId: role.id },
        }),
        { params: Promise.resolve({ id: committee.id }) }
      )
    );
    spy.mockRestore();
  });

  it("DELETE roles returns 500 on database failure", async () => {
    await makeAdmin(["committee.manage"]);
    const u = await createTestUser();
    const m = await createTestMember({ userId: u.user.id });
    const role = await createTestRole({ name: `Role2-${uniqueSuffix()}` });
    const cmr = await prisma.committeeMemberRole.create({
      data: { committeeId: committee.id, memberId: m.id, roleId: role.id },
    });
    const spy = vi
      .spyOn(prisma.committeeMemberRole, "update")
      .mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      COMMITTEE_ROLE_DELETE(
        mockRequest(`/api/committees/${committee.id}/roles?memberRoleId=${cmr.id}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: committee.id }) }
      )
    );
    spy.mockRestore();
  });
});

describe("Public routes error paths", () => {
  it("public/departments returns 500 on failure", async () => {
    const spy = vi.spyOn(prisma.department, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => PUBLIC_DEPARTMENTS_GET());
    spy.mockRestore();
  });

  it("public/departments returns departments with counts", async () => {
    await createTestDepartment({});
    const res = await PUBLIC_DEPARTMENTS_GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0]).toHaveProperty("_count");
  });

  it("public/recruitment returns 500 on failure", async () => {
    const spy = vi
      .spyOn(prisma.registrationWindow, "findMany")
      .mockRejectedValueOnce(new Error("boom"));
    await expect500(() => PUBLIC_RECRUITMENT_GET());
    spy.mockRestore();
  });

  it("public/recruitment only returns LIVE windows in period", async () => {
    await prisma.registrationWindow.create({
      data: { title: "Draft", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "DRAFT" },
    });
    await prisma.registrationWindow.create({
      data: { title: "Live", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    const res = await PUBLIC_RECRUITMENT_GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].title).toBe("Live");
  });

  it("public/about returns 500 on failure", async () => {
    const spy = vi.spyOn(prisma.systemSetting, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => PUBLIC_ABOUT_GET());
    spy.mockRestore();
  });

  it("public/about merges club settings", async () => {
    await prisma.systemSetting.create({
      data: { key: "clubName", value: { string: "My Club" } },
    });
    const res = await PUBLIC_ABOUT_GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.clubName).toEqual({ string: "My Club" });
  });

  it("public/committee returns 404 without current committee", async () => {
    await cleanupTestData();
    await seedPermissions();
    const res = await PUBLIC_COMMITTEE_GET();
    expect(res.status).toBe(404);
  });

  it("public/committee returns 500 on failure", async () => {
    const spy = vi.spyOn(prisma.committee, "findFirst").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => PUBLIC_COMMITTEE_GET());
    spy.mockRestore();
  });

  it("public/home returns 500 on failure", async () => {
    const spy = vi.spyOn(prisma.clubUpdate, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => PUBLIC_HOME_GET());
    spy.mockRestore();
  });

  it("public/home returns null committee when none exists", async () => {
    await cleanupTestData();
    await seedPermissions();
    const res = await PUBLIC_HOME_GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.committee).toBeNull();
    expect(data.departments).toEqual([]);
  });

  it("public/productions returns 500 on failure", async () => {
    const spy = vi.spyOn(prisma.event, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => PUBLIC_PRODUCTIONS_GET(mockRequest("/api/public/productions")));
    spy.mockRestore();
  });

  it("public/productions filters to PERFORMANCE type", async () => {
    await prisma.event.create({
      data: { title: "Play", type: "PERFORMANCE", status: "UPCOMING", startAt: new Date("2030-01-01") },
    });
    await prisma.event.create({
      data: { title: "Workshop", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2030-01-01") },
    });
    const res = await PUBLIC_PRODUCTIONS_GET(mockRequest("/api/public/productions"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].title).toBe("Play");
  });

  it("public/events returns 500 on failure", async () => {
    const spy = vi.spyOn(prisma.event, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => PUBLIC_EVENTS_GET(mockRequest("/api/public/events")));
    spy.mockRestore();
  });

  it("public/events supports upcoming=false", async () => {
    await prisma.event.create({
      data: { title: "Past", type: "WORKSHOP", status: "COMPLETED", startAt: new Date("2020-01-01") },
    });
    const res = await PUBLIC_EVENTS_GET(mockRequest("/api/public/events", { searchParams: { upcoming: "false" } }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it("public/gallery returns 500 on failure", async () => {
    const spy = vi.spyOn(prisma.galleryAlbum, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => PUBLIC_GALLERY_GET(mockRequest("/api/public/gallery")));
    spy.mockRestore();
  });

  it("public/gallery supports category and departmentId filters", async () => {
    await prisma.galleryAlbum.create({ data: { name: "Prod", category: "PRODUCTIONS" } });
    await prisma.galleryAlbum.create({ data: { name: "Life", category: "CLUB_LIFE" } });
    const res = await PUBLIC_GALLERY_GET(
      mockRequest("/api/public/gallery", { searchParams: { category: "PRODUCTIONS" } })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].name).toBe("Prod");
  });

  it("public/gallery/[id] returns 500 on failure", async () => {
    const spy = vi.spyOn(prisma.galleryAlbum, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      PUBLIC_GALLERY_ONE_GET(mockRequest("/api/public/gallery/x"), {
        params: Promise.resolve({ id: "x" }),
      })
    );
    spy.mockRestore();
  });

  it("public/updates returns 500 on failure", async () => {
    const spy = vi.spyOn(prisma.clubUpdate, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => PUBLIC_UPDATES_GET(mockRequest("/api/public/updates")));
    spy.mockRestore();
  });
});

describe("Auth & session error paths", () => {
  it("session returns 500 when permission lookup fails", async () => {
    const user = await createTestUser();
    mockAuth(user.user.id);
    const permsModule = await import("@/lib/permissions");
    const spy = vi
      .spyOn(permsModule, "getUserPermissions")
      .mockRejectedValueOnce(new Error("boom"));
    await expect500(() => SESSION_GET());
    spy.mockRestore();
  });

  it("session returns user with permissions", async () => {
    const { user } = await setupUser(["member.view"]);
    mockAuth(user.id, ["member.view"]);
    const res = await SESSION_GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.user.permissions).toContain("member.view");
  });

  it("register returns 500 on database failure", async () => {
    const spy = vi.spyOn(prisma.user, "create").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      REGISTER_POST(
        mockRequest("/api/auth/register", {
          method: "POST",
          body: { name: "X", email: `reg-${uniqueSuffix()}@test.com`, password: "password123" },
          headers: { "x-forwarded-for": `20.1.${Math.floor(Math.random() * 200) + 1}.1` },
        })
      )
    );
    spy.mockRestore();
  });

  it("register cleans up expired rate limit records", async () => {
    const ip = `20.2.${Math.floor(Math.random() * 200) + 1}.1`;
    const emailBase = `regclean-${uniqueSuffix()}`;
    vi.useFakeTimers({ toFake: ["Date"] });
    const t0 = Date.now();

    const body = (i: number) => ({
      name: "X",
      email: `${emailBase}-${i}@test.com`,
      password: "password123",
    });

    const r1 = await REGISTER_POST(
      mockRequest("/api/auth/register", { method: "POST", body: body(1), headers: { "x-forwarded-for": ip } })
    );
    expect(r1.status).toBe(201);

    vi.setSystemTime(new Date(t0 + 6 * 60 * 1000));
    const r2 = await REGISTER_POST(
      mockRequest("/api/auth/register", { method: "POST", body: body(2), headers: { "x-forwarded-for": ip } })
    );
    expect(r2.status).toBe(201);

    vi.setSystemTime(new Date(t0 + 67 * 60 * 1000));
    const r3 = await REGISTER_POST(
      mockRequest("/api/auth/register", { method: "POST", body: body(3), headers: { "x-forwarded-for": ip } })
    );
    expect(r3.status).toBe(201);

    vi.setSystemTime(new Date(t0 + 67 * 60 * 1000 + 1000));
    const r4 = await REGISTER_POST(
      mockRequest("/api/auth/register", { method: "POST", body: body(4), headers: { "x-forwarded-for": ip } })
    );
    expect(r4.status).toBe(201);

    vi.setSystemTime(new Date(t0 + 67 * 60 * 1000 + 2000));
    const r5 = await REGISTER_POST(
      mockRequest("/api/auth/register", { method: "POST", body: body(5), headers: { "x-forwarded-for": ip } })
    );
    expect(r5.status).toBe(201);

    vi.setSystemTime(new Date(t0 + 67 * 60 * 1000 + 3000));
    const r6 = await REGISTER_POST(
      mockRequest("/api/auth/register", { method: "POST", body: body(6), headers: { "x-forwarded-for": ip } })
    );
    expect(r6.status).toBe(429);
  });
});

describe("Members error paths", () => {
  it("GET returns 500 on failure", async () => {
    await makeAdmin(["member.view"]);
    const spy = vi.spyOn(prisma.member, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => MEMBERS_GET(mockRequest("/api/members")));
    spy.mockRestore();
  });

  it("POST returns 500 on failure", async () => {
    await makeAdmin(["member.create"]);
    const u = await createTestUser();
    const spy = vi.spyOn(prisma.member, "create").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      MEMBERS_POST(
        mockRequest("/api/members", {
          method: "POST",
          body: { userId: u.user.id, memberCode: `M${uniqueSuffix()}` },
        })
      )
    );
    spy.mockRestore();
  });

  it("GET [id] returns 500 on failure", async () => {
    await makeAdmin(["member.view"]);
    const m = await createTestMember({});
    const spy = vi.spyOn(prisma.member, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      MEMBER_GET(mockRequest(`/api/members/${m.id}`), { params: Promise.resolve({ id: m.id }) })
    );
    spy.mockRestore();
  });

  it("PATCH returns 400 on invalid status", async () => {
    await makeAdmin(["member.edit"]);
    const m = await createTestMember({});
    const res = await MEMBER_PATCH(
      mockRequest(`/api/members/${m.id}`, { method: "PATCH", body: { status: "BOGUS" } }),
      { params: Promise.resolve({ id: m.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("PATCH returns 500 on failure", async () => {
    await makeAdmin(["member.edit"]);
    const m = await createTestMember({});
    const spy = vi.spyOn(prisma.member, "update").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      MEMBER_PATCH(
        mockRequest(`/api/members/${m.id}`, { method: "PATCH", body: { phone: "123" } }),
        { params: Promise.resolve({ id: m.id }) }
      )
    );
    spy.mockRestore();
  });

  it("POST departments returns 400 on invalid body", async () => {
    await makeAdmin(["department.manage"]);
    const m = await createTestMember({});
    const res = await MEMBER_DEPT_POST(
      mockRequest(`/api/members/${m.id}/departments`, { method: "POST", body: {} }),
      { params: Promise.resolve({ id: m.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("POST departments returns 500 on failure", async () => {
    await makeAdmin(["department.manage"]);
    const m = await createTestMember({});
    const spy = vi.spyOn(prisma.memberDepartment, "create").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      MEMBER_DEPT_POST(
        mockRequest(`/api/members/${m.id}/departments`, {
          method: "POST",
          body: { departmentId: department.id },
        }),
        { params: Promise.resolve({ id: m.id }) }
      )
    );
    spy.mockRestore();
  });

  it("DELETE departments returns 500 on failure", async () => {
    await makeAdmin(["department.manage"]);
    const m = await createTestMember({});
    await prisma.memberDepartment.create({ data: { memberId: m.id, departmentId: department.id } });
    const spy = vi.spyOn(prisma.memberDepartment, "delete").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      MEMBER_DEPT_DELETE(
        mockRequest(`/api/members/${m.id}/departments?departmentId=${department.id}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: m.id }) }
      )
    );
    spy.mockRestore();
  });
});

describe("Departments & tasks error paths", () => {
  it("GET returns 500 on failure", async () => {
    await makeAdmin(["department.view"]);
    const spy = vi.spyOn(prisma.department, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => DEPARTMENTS_GET(mockRequest("/api/departments")));
    spy.mockRestore();
  });

  it("POST returns 500 on failure", async () => {
    await makeAdmin(["department.manage"]);
    const spy = vi.spyOn(prisma.department, "create").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      DEPARTMENTS_POST(
        mockRequest("/api/departments", {
          method: "POST",
          body: { name: "New", committeeId: committee.id },
        })
      )
    );
    spy.mockRestore();
  });

  it("POST returns 404 for nonexistent coordinator", async () => {
    await makeAdmin(["department.manage"]);
    const res = await DEPARTMENTS_POST(
      mockRequest("/api/departments", {
        method: "POST",
        body: { name: "New", committeeId: committee.id, coordinatorId: "cl00000000000000000000000" },
      })
    );
    expect(res.status).toBe(404);
  });

  it("GET [id] returns 500 on failure", async () => {
    await makeAdmin(["department.view"]);
    const spy = vi.spyOn(prisma.department, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      DEPARTMENT_GET(mockRequest(`/api/departments/${department.id}`), {
        params: Promise.resolve({ id: department.id }),
      })
    );
    spy.mockRestore();
  });

  it("PATCH returns 400 on invalid body", async () => {
    await makeAdmin(["department.manage"]);
    const res = await DEPARTMENT_PATCH(
      mockRequest(`/api/departments/${department.id}`, { method: "PATCH", body: { name: "" } }),
      { params: Promise.resolve({ id: department.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("PATCH returns 404 for nonexistent coordinator", async () => {
    await makeAdmin(["department.manage"]);
    const res = await DEPARTMENT_PATCH(
      mockRequest(`/api/departments/${department.id}`, {
        method: "PATCH",
        body: { coordinatorId: "cl00000000000000000000000" },
      }),
      { params: Promise.resolve({ id: department.id }) }
    );
    expect(res.status).toBe(404);
  });

  it("PATCH returns 500 on failure", async () => {
    await makeAdmin(["department.manage"]);
    const spy = vi.spyOn(prisma.department, "update").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      DEPARTMENT_PATCH(
        mockRequest(`/api/departments/${department.id}`, { method: "PATCH", body: { name: "X" } }),
        { params: Promise.resolve({ id: department.id }) }
      )
    );
    spy.mockRestore();
  });

  it("GET tasks returns 500 on failure", async () => {
    await makeAdmin(["department.manage"]);
    const spy = vi.spyOn(prisma.task, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      TASKS_GET(mockRequest(`/api/departments/${department.id}/tasks`), {
        params: Promise.resolve({ id: department.id }),
      })
    );
    spy.mockRestore();
  });

  it("POST tasks returns 404 for nonexistent assignee", async () => {
    await makeAdmin(["department.manage"]);
    const res = await TASKS_POST(
      mockRequest(`/api/departments/${department.id}/tasks`, {
        method: "POST",
        body: { title: "Task", assigneeId: "cl00000000000000000000000" },
      }),
      { params: Promise.resolve({ id: department.id }) }
    );
    expect(res.status).toBe(404);
  });

  it("POST tasks returns 500 on failure", async () => {
    await makeAdmin(["department.manage"]);
    const spy = vi.spyOn(prisma.task, "create").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      TASKS_POST(
        mockRequest(`/api/departments/${department.id}/tasks`, {
          method: "POST",
          body: { title: "Task" },
        }),
        { params: Promise.resolve({ id: department.id }) }
      )
    );
    spy.mockRestore();
  });

  it("PATCH task returns 400 on invalid status", async () => {
    await makeAdmin(["department.manage"]);
    const task = await prisma.task.create({ data: { departmentId: department.id, title: "T" } });
    const res = await TASK_PATCH(
      mockRequest(`/api/departments/${department.id}/tasks/${task.id}`, {
        method: "PATCH",
        body: { status: "BOGUS" },
      }),
      { params: Promise.resolve({ id: department.id, taskId: task.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("PATCH task returns 500 on failure", async () => {
    await makeAdmin(["department.manage"]);
    const task = await prisma.task.create({ data: { departmentId: department.id, title: "T" } });
    const spy = vi.spyOn(prisma.task, "update").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      TASK_PATCH(
        mockRequest(`/api/departments/${department.id}/tasks/${task.id}`, {
          method: "PATCH",
          body: { title: "New" },
        }),
        { params: Promise.resolve({ id: department.id, taskId: task.id }) }
      )
    );
    spy.mockRestore();
  });

  it("DELETE task returns 500 on failure", async () => {
    await makeAdmin(["department.manage"]);
    const task = await prisma.task.create({ data: { departmentId: department.id, title: "T" } });
    const spy = vi.spyOn(prisma.task, "delete").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      TASK_DELETE(
        mockRequest(`/api/departments/${department.id}/tasks/${task.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: department.id, taskId: task.id }) }
      )
    );
    spy.mockRestore();
  });
});

describe("Registration windows error paths", () => {
  it("GET returns 500 on failure", async () => {
    await makeAdmin(["registration.manage"]);
    const spy = vi.spyOn(prisma.registrationWindow, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => RW_GET(mockRequest("/api/registration-windows")));
    spy.mockRestore();
  });

  it("POST returns 500 on failure", async () => {
    await makeAdmin(["registration.manage"]);
    const spy = vi.spyOn(prisma.registrationWindow, "create").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      RW_POST(
        mockRequest("/api/registration-windows", {
          method: "POST",
          body: { title: "T", description: "d", startDate: "2024-01-01T00:00:00.000Z", endDate: "2024-02-01T00:00:00.000Z" },
        })
      )
    );
    spy.mockRestore();
  });

  it("GET [id] returns 500 on failure", async () => {
    await makeAdmin(["registration.manage"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "T", description: "d", startDate: new Date(), endDate: new Date(), status: "LIVE" },
    });
    const spy = vi.spyOn(prisma.registrationWindow, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      RW_ONE_GET(mockRequest(`/api/registration-windows/${rw.id}`), {
        params: Promise.resolve({ id: rw.id }),
      })
    );
    spy.mockRestore();
  });

  it("PATCH returns 400 on invalid status", async () => {
    await makeAdmin(["registration.manage"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "T", description: "d", startDate: new Date(), endDate: new Date(), status: "DRAFT" },
    });
    const res = await RW_ONE_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "BOGUS" } }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("PATCH returns 500 on failure", async () => {
    await makeAdmin(["registration.manage"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "T", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "DRAFT" },
    });
    const spy = vi.spyOn(prisma.registrationWindow, "update").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      RW_ONE_PATCH(
        mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { title: "X" } }),
        { params: Promise.resolve({ id: rw.id }) }
      )
    );
    spy.mockRestore();
  });
});

describe("Applicants error paths", () => {
  it("GET returns 500 on failure", async () => {
    await makeAdmin(["registration.review"]);
    const spy = vi.spyOn(prisma.applicant, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => APPLICANTS_GET(mockRequest("/api/applicants")));
    spy.mockRestore();
  });

  it("GET [id] returns 500 on failure", async () => {
    await makeAdmin(["registration.review"]);
    const spy = vi.spyOn(prisma.applicant, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      APPLICANT_GET(mockRequest("/api/applicants/x"), { params: Promise.resolve({ id: "x" }) })
    );
    spy.mockRestore();
  });

  it("PATCH still succeeds when email sending fails", async () => {
    await makeAdmin(["registration.review"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date(), endDate: new Date(), status: "LIVE" },
    });
    const app = await prisma.applicant.create({
      data: { registrationWindowId: rw.id, name: "A", email: `ap-${uniqueSuffix()}@test.com`, phone: "1", studentId: "S", departmentPrefs: [], status: "SUBMITTED" },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("smtp down"));
    vi.mocked(applicantStatusEmail).mockReturnValue({ subject: "S", html: "<p>H</p>" });

    const res = await APPLICANT_PATCH(
      mockRequest(`/api/applicants/${app.id}`, { method: "PATCH", body: { status: "ACCEPTED" } }),
      { params: Promise.resolve({ id: app.id }) }
    );
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("PATCH returns 500 on failure", async () => {
    await makeAdmin(["registration.review"]);
    const spy = vi.spyOn(prisma.applicant, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      APPLICANT_PATCH(
        mockRequest("/api/applicants/x", { method: "PATCH", body: { status: "ACCEPTED" } }),
        { params: Promise.resolve({ id: "x" }) }
      )
    );
    spy.mockRestore();
  });

  it("convert returns 400 for short password", async () => {
    await makeAdmin(["member.create"]);
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date(), endDate: new Date(), status: "LIVE" },
    });
    const app = await prisma.applicant.create({
      data: { registrationWindowId: rw.id, name: "A", email: `cv-${uniqueSuffix()}@test.com`, phone: "1", studentId: "S", departmentPrefs: [], status: "ACCEPTED" },
    });
    const res = await CONVERT_POST(
      mockRequest(`/api/applicants/${app.id}/convert`, { method: "POST", body: { password: "short" } }),
      { params: Promise.resolve({ id: app.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("convert returns 409 when email already exists (P2002)", async () => {
    await makeAdmin(["member.create"]);
    const email = `dup-${uniqueSuffix()}@test.com`;
    await createTestUser({ email });
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date(), endDate: new Date(), status: "LIVE" },
    });
    const app = await prisma.applicant.create({
      data: { registrationWindowId: rw.id, name: "A", email, phone: "1", studentId: "S", departmentPrefs: [], status: "ACCEPTED" },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await CONVERT_POST(
      mockRequest(`/api/applicants/${app.id}/convert`, { method: "POST", body: {} }),
      { params: Promise.resolve({ id: app.id }) }
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("already exists");
    consoleSpy.mockRestore();
  });

  it("convert returns 500 on failure", async () => {
    await makeAdmin(["member.create"]);
    const spy = vi.spyOn(prisma.applicant, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      CONVERT_POST(mockRequest("/api/applicants/x/convert", { method: "POST", body: {} }), {
        params: Promise.resolve({ id: "x" }),
      })
    );
    spy.mockRestore();
  });

  it("export returns 500 on failure", async () => {
    await makeAdmin(["registration.review"]);
    const spy = vi.spyOn(prisma.applicant, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      APPLICANTS_EXPORT_GET(mockRequest("/api/applicants/export", { searchParams: { windowId: "x" } }))
    );
    spy.mockRestore();
  });
});

describe("Promotions error paths", () => {
  it("GET returns 403 without submit/approve permissions", async () => {
    await makeAdmin([]);
    const res = await PROMOTIONS_GET(mockRequest("/api/promotions"));
    expect(res.status).toBe(403);
  });

  it("GET returns 500 on failure", async () => {
    await makeAdmin(["promotion.submit"]);
    const spy = vi.spyOn(prisma.promotionRequest, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => PROMOTIONS_GET(mockRequest("/api/promotions")));
    spy.mockRestore();
  });

  it("POST returns 404 for nonexistent current role", async () => {
    await makeAdmin(["promotion.submit"]);
    const m = await createTestMember({});
    const proposed = await createTestRole({ name: `PR-${uniqueSuffix()}` });
    const res = await PROMOTIONS_POST(
      mockRequest("/api/promotions", {
        method: "POST",
        body: { memberId: m.id, currentRoleId: "cl00000000000000000000000", proposedRoleId: proposed.id, reason: "good work" },
      })
    );
    expect(res.status).toBe(404);
  });

  it("POST returns 404 for nonexistent proposed role", async () => {
    await makeAdmin(["promotion.submit"]);
    const m = await createTestMember({});
    const current = await createTestRole({ name: `CR-${uniqueSuffix()}` });
    const res = await PROMOTIONS_POST(
      mockRequest("/api/promotions", {
        method: "POST",
        body: { memberId: m.id, currentRoleId: current.id, proposedRoleId: "cl00000000000000000000000", reason: "good work" },
      })
    );
    expect(res.status).toBe(404);
  });

  it("POST returns 500 on failure", async () => {
    await makeAdmin(["promotion.submit"]);
    const m = await createTestMember({});
    const current = await createTestRole({ name: `C2-${uniqueSuffix()}` });
    const proposed = await createTestRole({ name: `P2-${uniqueSuffix()}` });
    await assignCommitteeRole(m.id, current.id, committee.id);
    const spy = vi.spyOn(prisma.promotionRequest, "create").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      PROMOTIONS_POST(
        mockRequest("/api/promotions", {
          method: "POST",
          body: { memberId: m.id, currentRoleId: current.id, proposedRoleId: proposed.id, reason: "good work" },
        })
      )
    );
    spy.mockRestore();
  });

  it("GET [id] returns 403 without permissions", async () => {
    await makeAdmin([]);
    const res = await PROMOTION_GET(mockRequest("/api/promotions/x"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(403);
  });

  it("GET [id] returns 500 on failure", async () => {
    await makeAdmin(["promotion.submit"]);
    const spy = vi.spyOn(prisma.promotionRequest, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      PROMOTION_GET(mockRequest("/api/promotions/x"), { params: Promise.resolve({ id: "x" }) })
    );
    spy.mockRestore();
  });

  async function makePromotion(memberId: string, submittedById: string) {
    const current = await createTestRole({ name: `Cur-${uniqueSuffix()}` });
    const proposed = await createTestRole({ name: `Prop-${uniqueSuffix()}` });
    return prisma.promotionRequest.create({
      data: {
        memberId,
        currentRoleId: current.id,
        proposedRoleId: proposed.id,
        reason: "Deserves it",
        submittedById,
        status: "DRAFT",
      },
    });
  }

  it("submit returns 403 for unrelated user", async () => {
    const owner = await setupUser(["promotion.submit"]);
    const other = await setupUser(["promotion.submit"]);
    const promo = await makePromotion(owner.member.id, owner.user.id);
    mockAuth(other.user.id, ["promotion.submit"]);

    const res = await PROMOTION_SUBMIT_POST(
      mockRequest(`/api/promotions/${promo.id}/submit`, { method: "POST" }),
      { params: Promise.resolve({ id: promo.id }) }
    );
    expect(res.status).toBe(403);
  });

  it("submit still succeeds when approver notification fails", async () => {
    const s = await setupUser(["promotion.submit"]);
    const promo = await makePromotion(s.member.id, s.user.id);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(prisma.rolePermission, "findMany")
      .mockRejectedValueOnce(new Error("boom"));

    const res = await PROMOTION_SUBMIT_POST(
      mockRequest(`/api/promotions/${promo.id}/submit`, { method: "POST" }),
      { params: Promise.resolve({ id: promo.id }) }
    );
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("submit returns 500 on failure", async () => {
    await setupUser(["promotion.submit"]);
    const spy = vi.spyOn(prisma.promotionRequest, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      PROMOTION_SUBMIT_POST(mockRequest("/api/promotions/x/submit", { method: "POST" }), {
        params: Promise.resolve({ id: "x" }),
      })
    );
    spy.mockRestore();
  });

  it("decision returns 400 on invalid decision status", async () => {
    await makeAdmin(["promotion.approve"]);
    const u = await createTestUser();
    const m = await createTestMember({ userId: u.user.id });
    const promo = await makePromotion(m.id, admin.id);
    const res = await PROMOTION_DECISION_POST(
      mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "SUBMITTED" } }),
      { params: Promise.resolve({ id: promo.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("decision returns 500 when no current committee exists", async () => {
    const s = await setupUser(["promotion.approve"]);
    const subject = await createTestUser();
    const subjectMember = await createTestMember({ userId: subject.user.id });
    const promo = await makePromotion(subjectMember.id, s.user.id);
    await prisma.promotionRequest.update({ where: { id: promo.id }, data: { status: "SUBMITTED" } });
    const permsModule = await import("@/lib/permissions");
    const canSpy = vi.spyOn(permsModule, "can").mockResolvedValue(true);
    await prisma.committee.updateMany({ data: { isCurrent: false } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await PROMOTION_DECISION_POST(
      mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
      { params: Promise.resolve({ id: promo.id }) }
    );
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
    canSpy.mockRestore();
  });

  it("decision still succeeds when notification fails", async () => {
    const s = await setupUser(["promotion.approve"]);
    const subject = await createTestUser();
    const subjectMember = await createTestMember({ userId: subject.user.id });
    const promo = await makePromotion(subjectMember.id, s.user.id);
    await prisma.promotionRequest.update({ where: { id: promo.id }, data: { status: "SUBMITTED" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createNotification).mockRejectedValueOnce(new Error("boom"));

    const res = await PROMOTION_DECISION_POST(
      mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
      { params: Promise.resolve({ id: promo.id }) }
    );
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("decision returns 500 on failure", async () => {
    await makeAdmin(["promotion.approve"]);
    const spy = vi.spyOn(prisma.promotionRequest, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      PROMOTION_DECISION_POST(mockRequest("/api/promotions/x/decision", { method: "POST", body: { status: "APPROVED" } }), {
        params: Promise.resolve({ id: "x" }),
      })
    );
    spy.mockRestore();
  });
});

describe("Events error paths", () => {
  it("GET returns 500 on failure", async () => {
    await makeAdmin(["events.manage"]);
    const spy = vi.spyOn(prisma.event, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => EVENTS_GET(mockRequest("/api/events")));
    spy.mockRestore();
  });

  it("POST returns 500 on failure", async () => {
    await makeAdmin(["events.manage"]);
    const spy = vi.spyOn(prisma.event, "create").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      EVENTS_POST(
        mockRequest("/api/events", {
          method: "POST",
          body: { title: "E", type: "WORKSHOP", startAt: "2026-01-01T00:00:00.000Z" },
        })
      )
    );
    spy.mockRestore();
  });

  it("GET [id] returns 500 on failure", async () => {
    const spy = vi.spyOn(prisma.event, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => EVENT_GET(mockRequest("/api/events/x"), { params: Promise.resolve({ id: "x" }) }));
    spy.mockRestore();
  });

  it("PATCH still succeeds when department notification fails", async () => {
    await makeAdmin(["events.manage"]);
    const ev = await prisma.event.create({
      data: { title: "E", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2026-01-01"), departmentId: department.id },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(notifyDepartmentMembers).mockRejectedValueOnce(new Error("boom"));

    const res = await EVENT_PATCH(
      mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { title: "Renamed" } }),
      { params: Promise.resolve({ id: ev.id }) }
    );
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("PATCH returns 500 on failure", async () => {
    await makeAdmin(["events.manage"]);
    const ev = await prisma.event.create({
      data: { title: "E", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2026-01-01") },
    });
    const spy = vi.spyOn(prisma.event, "update").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      EVENT_PATCH(
        mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { title: "Renamed" } }),
        { params: Promise.resolve({ id: ev.id }) }
      )
    );
    spy.mockRestore();
  });

  it("DELETE still succeeds when department notification fails", async () => {
    await makeAdmin(["events.manage"]);
    const ev = await prisma.event.create({
      data: { title: "E", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2026-01-01"), departmentId: department.id },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(notifyDepartmentMembers).mockRejectedValueOnce(new Error("boom"));

    const res = await EVENT_DELETE(
      mockRequest(`/api/events/${ev.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: ev.id }) }
    );
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("DELETE without department notifies all active members", async () => {
    await makeAdmin(["events.manage"]);
    const ev = await prisma.event.create({
      data: { title: "E", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2026-01-01") },
    });
    const res = await EVENT_DELETE(
      mockRequest(`/api/events/${ev.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: ev.id }) }
    );
    expect(res.status).toBe(200);
    expect(notifyAllActiveMembers).toHaveBeenCalled();
  });

  it("DELETE returns 500 on failure", async () => {
    await makeAdmin(["events.manage"]);
    const ev = await prisma.event.create({
      data: { title: "E", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2026-01-01") },
    });
    const spy = vi.spyOn(prisma.event, "delete").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      EVENT_DELETE(mockRequest(`/api/events/${ev.id}`, { method: "DELETE" }), {
        params: Promise.resolve({ id: ev.id }),
      })
    );
    spy.mockRestore();
  });
});

describe("Updates error paths", () => {
  it("GET returns 500 on failure", async () => {
    const spy = vi.spyOn(prisma.clubUpdate, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => UPDATES_GET(mockRequest("/api/updates")));
    spy.mockRestore();
  });

  it("POST returns 500 on failure", async () => {
    await makeAdmin(["updates.publish"]);
    const spy = vi.spyOn(prisma.clubUpdate, "create").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      UPDATES_POST(
        mockRequest("/api/updates", {
          method: "POST",
          body: { title: "U", bodyRichText: "content", category: "ANNOUNCEMENT" },
        })
      )
    );
    spy.mockRestore();
  });

  it("GET [id] returns 404 for unpublished (draft) update", async () => {
    const u = await createTestUser();
    const update = await prisma.clubUpdate.create({
      data: { title: "Draft", bodyRichText: "x", category: "ANNOUNCEMENT", authorId: u.user.id },
    });
    const res = await UPDATE_GET(mockRequest(`/api/updates/${update.id}`), {
      params: Promise.resolve({ id: update.id }),
    });
    expect(res.status).toBe(404);
  });

  it("GET [id] returns 500 on failure", async () => {
    const spy = vi.spyOn(prisma.clubUpdate, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      UPDATE_GET(mockRequest("/api/updates/x"), { params: Promise.resolve({ id: "x" }) })
    );
    spy.mockRestore();
  });

  it("PATCH still succeeds when notification fails", async () => {
    await makeAdmin(["updates.publish"]);
    const update = await prisma.clubUpdate.create({
      data: {
        title: "Pub",
        bodyRichText: "x",
        category: "ANNOUNCEMENT",
        authorId: admin.id,
        publishedAt: new Date(),
      },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(notifyAllActiveMembers).mockRejectedValueOnce(new Error("boom"));

    const res = await UPDATE_PATCH(
      mockRequest(`/api/updates/${update.id}`, { method: "PATCH", body: { title: "Renamed" } }),
      { params: Promise.resolve({ id: update.id }) }
    );
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("PATCH returns 500 on failure", async () => {
    await makeAdmin(["updates.publish"]);
    const update = await prisma.clubUpdate.create({
      data: { title: "Pub", bodyRichText: "x", category: "ANNOUNCEMENT", authorId: admin.id, publishedAt: new Date() },
    });
    const spy = vi.spyOn(prisma.clubUpdate, "update").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      UPDATE_PATCH(
        mockRequest(`/api/updates/${update.id}`, { method: "PATCH", body: { title: "Renamed" } }),
        { params: Promise.resolve({ id: update.id }) }
      )
    );
    spy.mockRestore();
  });

  it("DELETE still succeeds when notification fails", async () => {
    await makeAdmin(["updates.publish"]);
    const update = await prisma.clubUpdate.create({
      data: { title: "Pub", bodyRichText: "x", category: "ANNOUNCEMENT", authorId: admin.id, publishedAt: new Date() },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(notifyAllActiveMembers).mockRejectedValueOnce(new Error("boom"));

    const res = await UPDATE_DELETE(
      mockRequest(`/api/updates/${update.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: update.id }) }
    );
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("DELETE returns 500 on failure", async () => {
    await makeAdmin(["updates.publish"]);
    const update = await prisma.clubUpdate.create({
      data: { title: "Pub", bodyRichText: "x", category: "ANNOUNCEMENT", authorId: admin.id },
    });
    const spy = vi.spyOn(prisma.clubUpdate, "delete").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      UPDATE_DELETE(mockRequest(`/api/updates/${update.id}`, { method: "DELETE" }), {
        params: Promise.resolve({ id: update.id }),
      })
    );
    spy.mockRestore();
  });
});

describe("Gallery error paths", () => {
  it("GET albums returns 500 on failure", async () => {
    await makeAdmin(["gallery.manage"]);
    const spy = vi.spyOn(prisma.galleryAlbum, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => GALLERY_GET(mockRequest("/api/gallery")));
    spy.mockRestore();
  });

  it("POST album returns 500 on failure", async () => {
    await makeAdmin(["gallery.manage"]);
    const spy = vi.spyOn(prisma.galleryAlbum, "create").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      GALLERY_POST(
        mockRequest("/api/gallery", { method: "POST", body: { name: "A", category: "CLUB_LIFE" } })
      )
    );
    spy.mockRestore();
  });

  it("GET items returns 500 on failure", async () => {
    const spy = vi.spyOn(prisma.galleryItem, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => GALLERY_ITEMS_GET(mockRequest("/api/gallery/items")));
    spy.mockRestore();
  });

  it("POST item to department album triggers notification", async () => {
    await makeAdmin(["gallery.upload"]);
    const album = await prisma.galleryAlbum.create({
      data: { name: "Dept Album", category: "CLUB_LIFE", departmentId: department.id },
    });

    const res = await GALLERY_ITEMS_POST(
      mockRequest("/api/gallery/items", {
        method: "POST",
        body: { albumId: album.id, r2Key: "gallery/x.jpg", fileName: "x.jpg", type: "IMAGE" },
      })
    );
    expect(res.status).toBe(201);
    expect(notifyDepartmentMembers).toHaveBeenCalled();
  });

  it("POST item returns 500 on failure", async () => {
    await makeAdmin(["gallery.upload"]);
    const album = await prisma.galleryAlbum.create({ data: { name: "A", category: "CLUB_LIFE" } });
    const spy = vi.spyOn(prisma.galleryItem, "create").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      GALLERY_ITEMS_POST(
        mockRequest("/api/gallery/items", {
          method: "POST",
          body: { albumId: album.id, r2Key: "gallery/x.jpg", fileName: "x.jpg", type: "IMAGE" },
        })
      )
    );
    spy.mockRestore();
  });

  it("upload-url returns signed URL when R2 is configured", async () => {
    await makeAdmin(["gallery.upload"]);
    const r2 = await import("@/lib/r2");
    const spy = vi
      .spyOn(r2, "getPresignedUploadUrl")
      .mockResolvedValueOnce({ uploadUrl: "https://signed.example", publicUrl: "https://cdn.example/x.jpg" });

    const res = await UPLOAD_URL_POST(
      mockRequest("/api/gallery/upload-url", {
        method: "POST",
        body: { fileName: "photo.jpg", contentType: "image/jpeg", fileSize: 1024, folder: "gallery", departmentId: department.id },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.uploadUrl).toBe("https://signed.example");
    expect(data.publicUrl).toBe("https://cdn.example/x.jpg");
    expect(data.key).toBeDefined();
    spy.mockRestore();
  });
});

describe("Roles, permissions & settings error paths", () => {
  it("roles GET returns 500 on failure", async () => {
    await makeAdmin(["permissions.manage"]);
    const spy = vi.spyOn(prisma.role, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => ROLES_GET());
    spy.mockRestore();
  });

  it("roles POST returns 500 on failure", async () => {
    await makeAdmin(["permissions.manage"]);
    const spy = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      ROLES_POST(mockRequest("/api/roles", { method: "POST", body: { name: "NewRole" } }))
    );
    spy.mockRestore();
  });

  it("role GET returns 500 on failure", async () => {
    await makeAdmin(["permissions.manage"]);
    const role = await createTestRole({ name: `R-${uniqueSuffix()}` });
    const spy = vi.spyOn(prisma.role, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => ROLE_GET(mockRequest(`/api/roles/${role.id}`), { params: Promise.resolve({ id: role.id }) }));
    spy.mockRestore();
  });

  it("role PATCH returns 400 on invalid body", async () => {
    await makeAdmin(["permissions.manage"]);
    const role = await createTestRole({ name: `R2-${uniqueSuffix()}` });
    const res = await ROLE_PATCH(
      mockRequest(`/api/roles/${role.id}`, { method: "PATCH", body: { name: "" } }),
      { params: Promise.resolve({ id: role.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("role PATCH returns 500 on failure", async () => {
    await makeAdmin(["permissions.manage"]);
    const role = await createTestRole({ name: `R3-${uniqueSuffix()}` });
    const spy = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      ROLE_PATCH(
        mockRequest(`/api/roles/${role.id}`, { method: "PATCH", body: { name: "X" } }),
        { params: Promise.resolve({ id: role.id }) }
      )
    );
    spy.mockRestore();
  });

  it("role DELETE returns 500 on failure", async () => {
    await makeAdmin(["permissions.manage"]);
    const role = await createTestRole({ name: `R4-${uniqueSuffix()}` });
    const spy = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      ROLE_DELETE(mockRequest(`/api/roles/${role.id}`, { method: "DELETE" }), {
        params: Promise.resolve({ id: role.id }),
      })
    );
    spy.mockRestore();
  });

  it("permissions GET returns 500 on failure", async () => {
    await makeAdmin(["permissions.manage"]);
    const spy = vi.spyOn(prisma.permission, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => PERMISSIONS_GET());
    spy.mockRestore();
  });

  it("permissions POST returns 500 on failure", async () => {
    await makeAdmin(["permissions.manage"]);
    const spy = vi.spyOn(prisma.permission, "upsert").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => PERMISSIONS_POST());
    spy.mockRestore();
  });

  it("settings GET returns 500 on failure", async () => {
    await makeAdmin(["settings.manage"]);
    const spy = vi.spyOn(prisma.systemSetting, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => SETTINGS_GET());
    spy.mockRestore();
  });

  it("settings PATCH rejects unknown keys", async () => {
    await makeAdmin(["settings.manage"]);
    const res = await SETTINGS_PATCH(
      mockRequest("/api/settings", { method: "PATCH", body: { evilKey: "x" } })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("invalid_enum_value");
  });

  it("settings PATCH returns 500 on failure", async () => {
    await makeAdmin(["settings.manage"]);
    const spy = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      SETTINGS_PATCH(mockRequest("/api/settings", { method: "PATCH", body: { clubName: "X" } }))
    );
    spy.mockRestore();
  });
});

describe("Notifications error paths", () => {
  it("GET returns 500 on failure", async () => {
    const u = await createTestUser();
    mockAuth(u.user.id);
    const spy = vi.spyOn(prisma.notification, "findMany").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => NOTIFICATIONS_GET(mockRequest("/api/notifications")));
    spy.mockRestore();
  });

  it("POST read returns 500 on failure", async () => {
    const u = await createTestUser();
    mockAuth(u.user.id);
    const n = await prisma.notification.create({
      data: { userId: u.user.id, type: "GENERAL", title: "T", message: "M" },
    });
    const spy = vi.spyOn(prisma.notification, "update").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      NOTIFICATION_READ_POST(mockRequest(`/api/notifications/${n.id}/read`, { method: "POST" }), {
        params: Promise.resolve({ id: n.id }),
      })
    );
    spy.mockRestore();
  });
});

describe("Dashboards error paths", () => {
  it("admin returns 500 on failure", async () => {
    await makeAdmin(["permissions.manage"]);
    const spy = vi.spyOn(prisma.member, "count").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => DASH_ADMIN_GET());
    spy.mockRestore();
  });

  it("department returns task counts and recruitment stats", async () => {
    const s = await setupUser(["department.view"]);
    await assignDepartment(s.member.id, department.id);
    await prisma.task.createMany({
      data: [
        { departmentId: department.id, title: "T1", status: "TODO" },
        { departmentId: department.id, title: "T2", status: "IN_PROGRESS" },
        { departmentId: department.id, title: "T3", status: "DONE" },
      ],
    });
    const rw = await prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    await prisma.applicant.createMany({
      data: [
        { registrationWindowId: rw.id, name: "A1", email: `d1-${uniqueSuffix()}@test.com`, phone: "1", studentId: "S1", departmentPrefs: [department.id], status: "SUBMITTED" },
        { registrationWindowId: rw.id, name: "A2", email: `d2-${uniqueSuffix()}@test.com`, phone: "2", studentId: "S2", departmentPrefs: [department.id], status: "ACCEPTED" },
      ],
    });

    const res = await DASH_DEPT_GET(
      mockRequest("/api/dashboard/department", { searchParams: { departmentId: department.id } })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.taskCounts.TODO).toBe(1);
    expect(data.taskCounts.IN_PROGRESS).toBe(1);
    expect(data.taskCounts.DONE).toBe(1);
    expect(data.recruitment.total).toBe(2);
    expect(data.recruitment.byStatus.SUBMITTED).toBe(1);
    expect(data.recruitment.byStatus.ACCEPTED).toBe(1);
  });

  it("department returns 500 on failure", async () => {
    const s = await setupUser(["department.view"]);
    await assignDepartment(s.member.id, department.id);
    const spy = vi.spyOn(prisma.task, "groupBy").mockRejectedValueOnce(new Error("boom"));
    await expect500(() =>
      DASH_DEPT_GET(mockRequest("/api/dashboard/department", { searchParams: { departmentId: department.id } }))
    );
    spy.mockRestore();
  });

  it("member returns 500 on failure", async () => {
    const u = await createTestUser();
    await createTestMember({ userId: u.user.id, status: "ACTIVE" });
    mockAuth(u.user.id);
    const spy = vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect500(() => DASH_MEMBER_GET());
    spy.mockRestore();
  });

  it("member returns empty state for user without member profile", async () => {
    const u = await createTestUser();
    mockAuth(u.user.id);
    const res = await DASH_MEMBER_GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.member).toBeNull();
    expect(data.departments).toEqual([]);
  });
});

describe("Contact cleanup branch", () => {
  it("cleans up expired rate limit records and re-blocks", async () => {
    const ip = `30.1.${Math.floor(Math.random() * 200) + 1}.1`;
    const emailBase = `contactc-${uniqueSuffix()}`;
    vi.useFakeTimers({ toFake: ["Date"] });
    const t0 = Date.now();

    const body = (i: number) => ({
      name: "X",
      email: `${emailBase}-${i}@test.com`,
      message: "This is a sufficiently long message",
    });

    const r1 = await CONTACT_POST(
      mockRequest("/api/contact", { method: "POST", body: body(1), headers: { "x-forwarded-for": ip } })
    );
    expect(r1.status).toBe(201);

    vi.setSystemTime(new Date(t0 + 6 * 60 * 1000));
    const r2 = await CONTACT_POST(
      mockRequest("/api/contact", { method: "POST", body: body(2), headers: { "x-forwarded-for": ip } })
    );
    expect(r2.status).toBe(201);

    vi.setSystemTime(new Date(t0 + 16 * 60 * 1000));
    const r3 = await CONTACT_POST(
      mockRequest("/api/contact", { method: "POST", body: body(3), headers: { "x-forwarded-for": ip } })
    );
    expect(r3.status).toBe(201);

    for (let i = 4; i <= 7; i++) {
      vi.setSystemTime(new Date(t0 + 16 * 60 * 1000 + (i - 3) * 1000));
      const res = await CONTACT_POST(
        mockRequest("/api/contact", { method: "POST", body: body(i), headers: { "x-forwarded-for": ip } })
      );
      expect(res.status).toBe(201);
    }

    vi.setSystemTime(new Date(t0 + 16 * 60 * 1000 + 6000));
    const blocked = await CONTACT_POST(
      mockRequest("/api/contact", { method: "POST", body: body(8), headers: { "x-forwarded-for": ip } })
    );
    expect(blocked.status).toBe(429);
  });
});
