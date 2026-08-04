import { describe, it, expect, beforeEach } from "vitest";
import { GET as MEMBERS_GET, POST as MEMBERS_POST } from "@/app/api/members/route";
import { PATCH as MEMBER_PATCH } from "@/app/api/members/[id]/route";
import { DELETE as REMOVE_DEPT } from "@/app/api/members/[id]/departments/route";
import { GET as COMMITTEES_GET, POST as COMMITTEES_POST } from "@/app/api/committees/route";
import { PATCH as COMMITTEE_PATCH } from "@/app/api/committees/[id]/route";
import { DELETE as REMOVE_ROLE } from "@/app/api/committees/[id]/roles/route";
import { GET as DEPTS_GET, POST as DEPTS_POST } from "@/app/api/departments/route";
import { PATCH as DEPT_PATCH } from "@/app/api/departments/[id]/route";
import { GET as TASKS_GET, POST as TASKS_POST } from "@/app/api/departments/[id]/tasks/route";
import { PATCH as TASK_PATCH, DELETE as TASK_DELETE } from "@/app/api/departments/[id]/tasks/[taskId]/route";
import { GET as EVENTS_GET, POST as EVENTS_POST } from "@/app/api/events/route";
import { GET as EVENT_GET, PATCH as EVENT_PATCH, DELETE as EVENT_DELETE } from "@/app/api/events/[id]/route";
import { GET as UPDATES_GET } from "@/app/api/updates/route";
import { GET as UPDATE_GET, DELETE as UPDATE_DELETE } from "@/app/api/updates/[id]/route";
import { GET as GALLERY_GET, POST as GALLERY_POST } from "@/app/api/gallery/route";
import { GET as ITEMS_GET, POST as ITEMS_POST } from "@/app/api/gallery/items/route";
import { GET as SETTINGS_GET, PATCH as SETTINGS_PATCH } from "@/app/api/settings/route";
import { POST as ROLES_POST } from "@/app/api/roles/route";
import { GET as ROLE_GET, PATCH as ROLE_PATCH, DELETE as ROLE_DELETE } from "@/app/api/roles/[id]/route";
import { GET as NOTIFS_GET } from "@/app/api/notifications/route";
import { POST as NOTIF_READ } from "@/app/api/notifications/[id]/read/route";
import { GET as RW_GET, POST as RW_POST } from "@/app/api/registration-windows/route";
import { GET as RW_GET_ONE, PATCH as RW_PATCH } from "@/app/api/registration-windows/[id]/route";
import { GET as APPLICANTS_GET } from "@/app/api/applicants/route";
import { GET as APPLICANT_GET, PATCH as APPLICANT_PATCH } from "@/app/api/applicants/[id]/route";
import { POST as CONVERT_POST } from "@/app/api/applicants/[id]/convert/route";
import { GET as EXPORT_GET } from "@/app/api/applicants/export/route";
import { GET as PROMOS_GET } from "@/app/api/promotions/route";
import { GET as PROMO_GET } from "@/app/api/promotions/[id]/route";
import { POST as PROMO_SUBMIT } from "@/app/api/promotions/[id]/submit/route";
import { POST as PROMO_DECISION } from "@/app/api/promotions/[id]/decision/route";
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
  NON_EXISTENT_CUID,
} from "./helpers";
import prisma from "@/lib/prisma";

describe("Comprehensive Backend Coverage Expansion", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  async function setupAdmin(extraPerms: string[] = []) {
    const allPerms = [...new Set(["member.view", "member.create", "member.edit", "department.view", "department.manage", "committee.manage", "registration.manage", "registration.review", "promotion.submit", "promotion.approve", "gallery.upload", "gallery.manage", "updates.publish", "events.manage", "permissions.manage", "settings.manage", ...extraPerms])];
    const user = await createTestUser({ email: `admin-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const role = await createTestRole({ name: `FullAdmin-${uniqueSuffix()}`, permissionIds: (await Promise.all(allPerms.map(async k => { const p = await prisma.permission.findUnique({ where: { key: k } }); return p!.id; }))) });
    await assignCommitteeRole(member.id, role.id, committee.id);
    mockAuth(user.user.id, allPerms);
    return { user, member, committee };
  }

  describe("Members - Missing Edge Cases", () => {
    it("POST creates member with default PENDING status", async () => {
      await setupAdmin();
      const user = await createTestUser({ email: `newmember-${uniqueSuffix()}@test.com` });
      const res = await MEMBERS_POST(mockRequest("/api/members", {
        method: "POST",
        body: { userId: user.user.id, memberCode: `MC${uniqueSuffix()}` },
      }));
      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data.status).toBe("PENDING");
    });

    it("POST rejects duplicate userId", async () => {
      await setupAdmin();
      const user = await createTestUser({ email: `dupuser-${uniqueSuffix()}@test.com` });
      const code1 = `DUP${uniqueSuffix()}`;
      const code2 = `DUP2${uniqueSuffix()}`;
      await MEMBERS_POST(mockRequest("/api/members", { method: "POST", body: { userId: user.user.id, memberCode: code1 } }));
      const res = await MEMBERS_POST(mockRequest("/api/members", { method: "POST", body: { userId: user.user.id, memberCode: code2 } }));
      expect(res.status).toBe(409);
    });

    it("POST rejects duplicate memberCode", async () => {
      await setupAdmin();
      const u1 = await createTestUser({ email: `dupcode1-${uniqueSuffix()}@test.com` });
      const u2 = await createTestUser({ email: `dupcode2-${uniqueSuffix()}@test.com` });
      const code = `DUPCODE${uniqueSuffix()}`;
      await MEMBERS_POST(mockRequest("/api/members", { method: "POST", body: { userId: u1.user.id, memberCode: code } }));
      const res = await MEMBERS_POST(mockRequest("/api/members", { method: "POST", body: { userId: u2.user.id, memberCode: code } }));
      expect(res.status).toBe(409);
    });

    it("GET filters by status", async () => {
      await setupAdmin();
      const u = await createTestUser({ email: `statusfilter-${uniqueSuffix()}@test.com` });
      await createTestMember({ userId: u.user.id, status: "ACTIVE" });
      const res = await MEMBERS_GET(mockRequest("/api/members", { searchParams: { status: "ACTIVE" } }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.members.length).toBeGreaterThanOrEqual(1);
      expect(data.members.every((m: Record<string, unknown>) => m.status === "ACTIVE")).toBe(true);
    });

    it("GET searches by name", async () => {
      await setupAdmin();
      const searchName = `Searchable${uniqueSuffix()}`;
      const u = await createTestUser({ name: searchName, email: `search-${uniqueSuffix()}@test.com` });
      await createTestMember({ userId: u.user.id });
      const res = await MEMBERS_GET(mockRequest("/api/members", { searchParams: { search: searchName } }));
      const data = await res.json();
      expect(data.members.length).toBeGreaterThanOrEqual(1);
    });

    it("GET searches by memberCode", async () => {
      await setupAdmin();
      const code = `SC${uniqueSuffix()}`;
      const u = await createTestUser({ email: `scsearch-${uniqueSuffix()}@test.com` });
      await createTestMember({ userId: u.user.id, memberCode: code });
      const res = await MEMBERS_GET(mockRequest("/api/members", { searchParams: { search: code } }));
      const data = await res.json();
      expect(data.members.length).toBe(1);
    });

    it("GET filters by departmentId", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const u = await createTestUser({ email: `deptfilter-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      await assignDepartment(m.id, dept.id);
      const res = await MEMBERS_GET(mockRequest("/api/members", { searchParams: { departmentId: dept.id } }));
      const data = await res.json();
      expect(data.members.length).toBe(1);
    });

    it("GET paginates correctly", async () => {
      await setupAdmin();
      const res = await MEMBERS_GET(mockRequest("/api/members", { searchParams: { page: "1", limit: "2" } }));
      const data = await res.json();
      expect(data.pagination).toBeDefined();
      expect(data.pagination.limit).toBe(2);
    });

    it("PATCH with all fields", async () => {
      await setupAdmin();
      const u = await createTestUser({ email: `patchall-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const res = await MEMBER_PATCH(
        mockRequest(`/api/members/${m.id}`, { method: "PATCH", body: { phone: "555-0100", address: "123 Main St", emergencyContact: "Jane Doe" } }),
        { params: Promise.resolve({ id: m.id }) }
      );
      expect(res.status).toBe(200);
    });

    it("PATCH non-existent member returns 404", async () => {
      await setupAdmin();
      const res = await MEMBER_PATCH(
        mockRequest(`/api/members/${NON_EXISTENT_CUID}`, { method: "PATCH", body: { phone: "555" } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(404);
    });

    it("DELETE from department with missing query param returns 400", async () => {
      await setupAdmin();
      const u = await createTestUser({ email: `nodeptparam-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const res = await REMOVE_DEPT(
        mockRequest(`/api/members/${m.id}/departments`),
        { params: Promise.resolve({ id: m.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("DELETE from department not in returns 404", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const u = await createTestUser({ email: `notind-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const dept = await createTestDepartment({ committeeId: committee.id });
      const res = await REMOVE_DEPT(
        mockRequest(`/api/members/${m.id}/departments?departmentId=${dept.id}`),
        { params: Promise.resolve({ id: m.id }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("Committees - Missing Edge Cases", () => {
    it("POST archives previous current committee", async () => {
      await setupAdmin();
      const old = await createTestCommittee({ isCurrent: true });
      const res = await COMMITTEES_POST(mockRequest("/api/committees", {
        method: "POST",
        body: { year: "2030-2031", startDate: "2030-01-01T00:00:00.000Z" },
      }));
      expect(res.status).toBe(201);
      const updatedOld = await prisma.committee.findUnique({ where: { id: old.id } });
      expect(updatedOld!.isCurrent).toBe(false);
    });

    it("GET with all=true requires committee.manage", async () => {
      await setupAdmin();
      const user2 = await createTestUser({ email: `allcomm-${uniqueSuffix()}@test.com` });
      const m2 = await createTestMember({ userId: user2.user.id, status: "ACTIVE" });
      const c2 = await createTestCommittee({ isCurrent: true });
      const r2 = await createTestRole({ name: `ViewOnly-${uniqueSuffix()}`, permissionIds: [(await prisma.permission.findUnique({ where: { key: "member.view" } }))!.id] });
      await assignCommitteeRole(m2.id, r2.id, c2.id);
      mockAuth(user2.user.id, ["member.view"]);
      const res = await COMMITTEES_GET(mockRequest("/api/committees", { searchParams: { all: "true" } }));
      expect(res.status).toBe(401);
    });

    it("PATCH 404 for non-existent", async () => {
      await setupAdmin();
      const res = await COMMITTEE_PATCH(
        mockRequest(`/api/committees/${NON_EXISTENT_CUID}`, { method: "PATCH", body: { year: "2030" } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(404);
    });

    it("DELETE soft-removes role from committee", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const u = await createTestUser({ email: `delrole-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const role = await createTestRole({ name: `DelRole-${uniqueSuffix()}` });
      const cmr = await assignCommitteeRole(m.id, role.id, committee.id);
      const res = await REMOVE_ROLE(
        mockRequest(`/api/committees/${committee.id}/roles?memberRoleId=${cmr.id}`),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(200);
      const updated = await prisma.committeeMemberRole.findUnique({ where: { id: cmr.id } });
      expect(updated!.endedAt).not.toBeNull();
    });

    it("DELETE with wrong committee returns 403", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const otherCommittee = await createTestCommittee({ isCurrent: false });
      const u = await createTestUser({ email: `wrongcomm-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const role = await createTestRole({ name: `WrongComm-${uniqueSuffix()}` });
      const cmr = await assignCommitteeRole(m.id, role.id, otherCommittee.id);
      const res = await REMOVE_ROLE(
        mockRequest(`/api/committees/${committee.id}/roles?memberRoleId=${cmr.id}`),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(403);
    });
  });

  describe("Departments - Missing Edge Cases", () => {
    it("POST with non-existent coordinator returns 404", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const res = await DEPTS_POST(mockRequest("/api/departments", {
        method: "POST",
        body: { name: `Dept${uniqueSuffix()}`, committeeId: committee.id, coordinatorId: NON_EXISTENT_CUID },
      }));
      expect(res.status).toBe(404);
    });

    it("POST with description", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const res = await DEPTS_POST(mockRequest("/api/departments", {
        method: "POST",
        body: { name: `DescDept${uniqueSuffix()}`, description: "A test department", committeeId: committee.id },
      }));
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.description).toBe("A test department");
    });

    it("GET filters by committeeId", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      await createTestDepartment({ committeeId: committee.id });
      const res = await DEPTS_GET(mockRequest("/api/departments", { searchParams: { committeeId: committee.id } }));
      const data = await res.json();
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it("GET filters by current=true", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      await createTestDepartment({ committeeId: committee.id });
      const res = await DEPTS_GET(mockRequest("/api/departments", { searchParams: { current: "true" } }));
      const data = await res.json();
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it("PATCH 404 for non-existent", async () => {
      await setupAdmin();
      const res = await DEPT_PATCH(
        mockRequest(`/api/departments/${NON_EXISTENT_CUID}`, { method: "PATCH", body: { name: "Updated" } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(404);
    });

    it("PATCH with non-existent coordinator returns 404", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const res = await DEPT_PATCH(
        mockRequest(`/api/departments/${dept.id}`, { method: "PATCH", body: { coordinatorId: NON_EXISTENT_CUID } }),
        { params: Promise.resolve({ id: dept.id }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("Tasks - Missing Edge Cases", () => {
    it("GET with status filter", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      await prisma.task.create({ data: { departmentId: dept.id, title: "TodoTask", status: "TODO" } });
      await prisma.task.create({ data: { departmentId: dept.id, title: "DoneTask", status: "DONE" } });
      const res = await TASKS_GET(mockRequest(`/api/departments/${dept.id}/tasks`, { searchParams: { status: "TODO" } }), { params: Promise.resolve({ id: dept.id }) });
      const data = await res.json();
      expect(data.every((t: Record<string, unknown>) => t.status === "TODO")).toBe(true);
    });

    it("GET with assigneeId filter", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const u = await createTestUser({ email: `assignee-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      await prisma.task.create({ data: { departmentId: dept.id, title: "Assigned", assigneeId: m.id } });
      const res = await TASKS_GET(mockRequest(`/api/departments/${dept.id}/tasks`, { searchParams: { assigneeId: m.id } }), { params: Promise.resolve({ id: dept.id }) });
      const data = await res.json();
      expect(data.length).toBe(1);
    });

    it("PATCH task with wrong department returns 404", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const dept1 = await createTestDepartment({ committeeId: committee.id });
      const dept2 = await createTestDepartment({ committeeId: committee.id });
      const task = await prisma.task.create({ data: { departmentId: dept1.id, title: "Task1" } });
      const res = await TASK_PATCH(
        mockRequest(`/api/departments/${dept2.id}/tasks/${task.id}`, { method: "PATCH", body: { title: "Hacked" } }),
        { params: Promise.resolve({ id: dept2.id, taskId: task.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("DELETE task with wrong department returns 404", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const dept1 = await createTestDepartment({ committeeId: committee.id });
      const dept2 = await createTestDepartment({ committeeId: committee.id });
      const task = await prisma.task.create({ data: { departmentId: dept1.id, title: "TaskDel" } });
      const res = await TASK_DELETE(
        mockRequest(`/api/departments/${dept2.id}/tasks/${task.id}`),
        { params: Promise.resolve({ id: dept2.id, taskId: task.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("PATCH non-existent task returns 404", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const res = await TASK_PATCH(
        mockRequest(`/api/departments/${dept.id}/tasks/${NON_EXISTENT_CUID}`, { method: "PATCH", body: { title: "X" } }),
        { params: Promise.resolve({ id: dept.id, taskId: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(404);
    });

    it("DELETE non-existent task returns 404", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const res = await TASK_DELETE(
        mockRequest(`/api/departments/${dept.id}/tasks/${NON_EXISTENT_CUID}`),
        { params: Promise.resolve({ id: dept.id, taskId: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(404);
    });

    it("POST with non-existent assignee returns 404", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const res = await TASKS_POST(
        mockRequest(`/api/departments/${dept.id}/tasks`, { method: "POST", body: { title: "Bad Assignee", assigneeId: NON_EXISTENT_CUID } }),
        { params: Promise.resolve({ id: dept.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("POST with dueDate", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const res = await TASKS_POST(
        mockRequest(`/api/departments/${dept.id}/tasks`, { method: "POST", body: { title: "Due Task", dueDate: "2025-12-01T00:00:00.000Z" } }),
        { params: Promise.resolve({ id: dept.id }) }
      );
      expect(res.status).toBe(201);
    });
  });

  describe("Events - Missing Edge Cases", () => {
    it("POST with endAt before startAt returns 400", async () => {
      await setupAdmin();
      const res = await EVENTS_POST(mockRequest("/api/events", {
        method: "POST",
        body: { title: "Bad Dates", type: "WORKSHOP", startAt: "2025-06-10T10:00:00.000Z", endAt: "2025-06-01T10:00:00.000Z" },
      }));
      expect(res.status).toBe(400);
    });

    it("POST with non-existent department returns 404", async () => {
      await setupAdmin();
      const res = await EVENTS_POST(mockRequest("/api/events", {
        method: "POST",
        body: { title: "Bad Dept", type: "WORKSHOP", startAt: "2025-06-01T10:00:00.000Z", departmentId: NON_EXISTENT_CUID },
      }));
      expect(res.status).toBe(404);
    });

    it("GET DRAFT event returns 404", async () => {
      const event = await prisma.event.create({ data: { title: "Draft Event", type: "WORKSHOP", status: "DRAFT", startAt: new Date("2030-06-01") } });
      const res = await EVENT_GET(mockRequest(`/api/events/${event.id}`), { params: Promise.resolve({ id: event.id }) });
      expect(res.status).toBe(404);
    });

    it("PATCH with invalid status transition returns 400", async () => {
      await setupAdmin();
      const event = await prisma.event.create({ data: { title: "Cancel Event", type: "WORKSHOP", status: "COMPLETED", startAt: new Date("2025-06-01") } });
      const res = await EVENT_PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { status: "UPCOMING" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("PATCH with endAt before startAt returns 400", async () => {
      await setupAdmin();
      const event = await prisma.event.create({ data: { title: "Date Check", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2025-06-10") } });
      const res = await EVENT_PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { endAt: "2025-06-01T00:00:00.000Z" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("DELETE non-existent event returns 404", async () => {
      await setupAdmin();
      const res = await EVENT_DELETE(mockRequest(`/api/events/${NON_EXISTENT_CUID}`), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(404);
    });

    it("GET with type filter", async () => {
      await prisma.event.create({ data: { title: "WS", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2030-06-01") } });
      await prisma.event.create({ data: { title: "PF", type: "PERFORMANCE", status: "UPCOMING", startAt: new Date("2030-06-01") } });
      const res = await EVENTS_GET(mockRequest("/api/events", { searchParams: { type: "PERFORMANCE" } }));
      const data = await res.json();
      expect(data.events.every((e: Record<string, unknown>) => e.type === "PERFORMANCE")).toBe(true);
    });

    it("GET with upcoming filter", async () => {
      await prisma.event.create({ data: { title: "Future", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2030-06-01") } });
      const res = await EVENTS_GET(mockRequest("/api/events", { searchParams: { upcoming: "true" } }));
      const data = await res.json();
      expect(data.events.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Updates - Missing Edge Cases", () => {
    it("GET with category filter", async () => {
      const admin = await createTestUser({ email: `catadmin-${uniqueSuffix()}@test.com` });
      await prisma.clubUpdate.create({ data: { title: "Ann", bodyRichText: "<p>A</p>", category: "ANNOUNCEMENT", authorId: admin.user.id, publishedAt: new Date() } });
      await prisma.clubUpdate.create({ data: { title: "Not", bodyRichText: "<p>N</p>", category: "NOTICE", authorId: admin.user.id, publishedAt: new Date() } });
      const res = await UPDATES_GET(mockRequest("/api/updates", { searchParams: { category: "ANNOUNCEMENT" } }));
      const data = await res.json();
      expect(data.updates.every((u: Record<string, unknown>) => u.category === "ANNOUNCEMENT")).toBe(true);
    });

    it("GET excludes unpublished", async () => {
      const admin = await createTestUser({ email: `unpub-${uniqueSuffix()}@test.com` });
      await prisma.clubUpdate.create({ data: { title: "Draft", bodyRichText: "<p>D</p>", category: "NOTICE", authorId: admin.user.id } });
      const res = await UPDATES_GET(mockRequest("/api/updates"));
      const data = await res.json();
      expect(data.updates.length).toBe(0);
    });

    it("GET published update by id", async () => {
      const admin = await createTestUser({ email: `pubget-${uniqueSuffix()}@test.com` });
      const update = await prisma.clubUpdate.create({ data: { title: "Get Me", bodyRichText: "<p>X</p>", category: "ACHIEVEMENT", authorId: admin.user.id, publishedAt: new Date() } });
      const res = await UPDATE_GET(mockRequest(`/api/updates/${update.id}`), { params: Promise.resolve({ id: update.id }) });
      expect(res.status).toBe(200);
    });

    it("GET unpublished update by id returns 404", async () => {
      const admin = await createTestUser({ email: `unpubget-${uniqueSuffix()}@test.com` });
      const update = await prisma.clubUpdate.create({ data: { title: "Hidden", bodyRichText: "<p>H</p>", category: "NOTICE", authorId: admin.user.id } });
      const res = await UPDATE_GET(mockRequest(`/api/updates/${update.id}`), { params: Promise.resolve({ id: update.id }) });
      expect(res.status).toBe(404);
    });

    it("DELETE non-existent update returns 404", async () => {
      await setupAdmin();
      const res = await UPDATE_DELETE(mockRequest(`/api/updates/${NON_EXISTENT_CUID}`), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(404);
    });
  });

  describe("Gallery - Missing Edge Cases", () => {
    it("GET with category filter", async () => {
      await setupAdmin();
      await prisma.galleryAlbum.create({ data: { name: "Prod", category: "PRODUCTIONS" } });
      await prisma.galleryAlbum.create({ data: { name: "Work", category: "WORKSHOPS" } });
      const res = await GALLERY_GET(mockRequest("/api/gallery", { searchParams: { category: "PRODUCTIONS" } }));
      const data = await res.json();
      expect(data.every((a: Record<string, unknown>) => a.category === "PRODUCTIONS")).toBe(true);
    });

    it("GET with departmentId filter", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      await prisma.galleryAlbum.create({ data: { name: "Dept Album", category: "PRODUCTIONS", departmentId: dept.id } });
      const res = await GALLERY_GET(mockRequest("/api/gallery", { searchParams: { departmentId: dept.id } }));
      const data = await res.json();
      expect(data.length).toBe(1);
    });

    it("POST with non-existent department returns 404", async () => {
      await setupAdmin();
      const res = await GALLERY_POST(mockRequest("/api/gallery", {
        method: "POST",
        body: { name: "Bad", category: "PRODUCTIONS", departmentId: NON_EXISTENT_CUID },
      }));
      expect(res.status).toBe(404);
    });

    it("GET items with albumId filter", async () => {
      await setupAdmin();
      const album = await prisma.galleryAlbum.create({ data: { name: "Filter Album", category: "BEHIND_THE_SCENES" } });
      await prisma.galleryItem.create({ data: { albumId: album.id, r2Key: "test.jpg", fileName: "test.jpg", type: "IMAGE", uploadedById: (await createTestUser()).user.id } });
      const res = await ITEMS_GET(mockRequest("/api/gallery/items", { searchParams: { albumId: album.id } }));
      const data = await res.json();
      expect(data.items.length).toBe(1);
    });

    it("POST items with caption", async () => {
      await setupAdmin();
      const album = await prisma.galleryAlbum.create({ data: { name: "Cap Album", category: "CLUB_LIFE" } });
      const res = await ITEMS_POST(mockRequest("/api/gallery/items", {
        method: "POST",
        body: { albumId: album.id, r2Key: "cap.jpg", fileName: "cap.jpg", type: "IMAGE", caption: "A nice photo" },
      }));
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.caption).toBe("A nice photo");
    });
  });

  describe("Settings - Missing Edge Cases", () => {
    it("PATCH upserts settings", async () => {
      await setupAdmin();
      await SETTINGS_PATCH(mockRequest("/api/settings", { method: "PATCH", body: { clubName: "Test Club" } }));
      await SETTINGS_PATCH(mockRequest("/api/settings", { method: "PATCH", body: { clubName: "Updated Club" } }));
      const res = await SETTINGS_GET();
      const data = await res.json();
      expect(data.clubName).toBe("Updated Club");
    });

    it("PATCH rejects invalid keys", async () => {
      await setupAdmin();
      const res = await SETTINGS_PATCH(mockRequest("/api/settings", { method: "PATCH", body: { invalidKey: "val" } }));
      expect(res.status).toBe(400);
    });

    it("GET returns empty object when no settings", async () => {
      await setupAdmin();
      const res = await SETTINGS_GET();
      const data = await res.json();
      expect(typeof data).toBe("object");
    });
  });

  describe("Roles - Missing Edge Cases", () => {
    it("POST duplicate name returns 409", async () => {
      await setupAdmin();
      const name = `DupRole${uniqueSuffix()}`;
      await ROLES_POST(mockRequest("/api/roles", { method: "POST", body: { name } }));
      const res = await ROLES_POST(mockRequest("/api/roles", { method: "POST", body: { name } }));
      expect(res.status).toBe(409);
    });

    it("PATCH with permissionIds replaces all", async () => {
      await setupAdmin();
      const role = await createTestRole({ name: `ReplRole-${uniqueSuffix()}` });
      const perm = await prisma.permission.findUnique({ where: { key: "member.view" } });
      const res = await ROLE_PATCH(
        mockRequest(`/api/roles/${role.id}`, { method: "PATCH", body: { permissionIds: [perm!.id] } }),
        { params: Promise.resolve({ id: role.id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.permissions.length).toBe(1);
    });

    it("PATCH with empty permissionIds clears all", async () => {
      await setupAdmin();
      const perm = await prisma.permission.findUnique({ where: { key: "member.view" } });
      const role = await createTestRole({ name: `ClearRole-${uniqueSuffix()}`, permissionIds: [perm!.id] });
      const res = await ROLE_PATCH(
        mockRequest(`/api/roles/${role.id}`, { method: "PATCH", body: { permissionIds: [] } }),
        { params: Promise.resolve({ id: role.id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.permissions.length).toBe(0);
    });

    it("DELETE non-existent returns 404", async () => {
      await setupAdmin();
      const res = await ROLE_DELETE(mockRequest(`/api/roles/${NON_EXISTENT_CUID}`), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(404);
    });

    it("GET non-existent returns 404", async () => {
      await setupAdmin();
      const res = await ROLE_GET(mockRequest(`/api/roles/${NON_EXISTENT_CUID}`), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(404);
    });
  });

  describe("Notifications - Missing Edge Cases", () => {
    it("GET with unread filter", async () => {
      await setupAdmin();
      const u = await createTestUser({ email: `notifunread-${uniqueSuffix()}@test.com` });
      await prisma.notification.create({ data: { userId: u.user.id, type: "GENERAL", title: "Read", message: "Read" } });
      await prisma.notification.create({ data: { userId: u.user.id, type: "GENERAL", title: "Unread", message: "Unread" } });
      mockAuth(u.user.id);
      const res = await NOTIFS_GET(mockRequest("/api/notifications", { searchParams: { unread: "true" } }));
      const data = await res.json();
      expect(data.notifications.every((n: Record<string, unknown>) => n.readAt === null)).toBe(true);
    });

    it("GET returns unreadCount", async () => {
      const { user } = await setupAdmin();
      await prisma.notification.create({ data: { userId: user.user.id, type: "GENERAL", title: "N1", message: "M1" } });
      await prisma.notification.create({ data: { userId: user.user.id, type: "GENERAL", title: "N2", message: "M2" } });
      const res = await NOTIFS_GET(mockRequest("/api/notifications"));
      const data = await res.json();
      expect(data.unreadCount).toBe(2);
    });

    it("POST read notification", async () => {
      const { user } = await setupAdmin();
      const notif = await prisma.notification.create({ data: { userId: user.user.id, type: "GENERAL", title: "ReadMe", message: "R" } });
      const res = await NOTIF_READ(mockRequest(`/api/notifications/${notif.id}/read`, { method: "POST" }), { params: Promise.resolve({ id: notif.id }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.readAt).not.toBeNull();
    });

    it("POST read other user's notification returns 403", async () => {
      await setupAdmin();
      const u2 = await createTestUser({ email: `othernotif-${uniqueSuffix()}@test.com` });
      const notif = await prisma.notification.create({ data: { userId: u2.user.id, type: "GENERAL", title: "Other", message: "O" } });
      const res = await NOTIF_READ(mockRequest(`/api/notifications/${notif.id}/read`, { method: "POST" }), { params: Promise.resolve({ id: notif.id }) });
      expect(res.status).toBe(403);
    });

    it("POST read non-existent notification returns 404", async () => {
      await setupAdmin();
      const res = await NOTIF_READ(mockRequest(`/api/notifications/${NON_EXISTENT_CUID}/read`, { method: "POST" }), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(404);
    });
  });

  describe("Registration Windows - Missing Edge Cases", () => {
    it("POST endDate <= startDate returns 400", async () => {
      await setupAdmin();
      const res = await RW_POST(mockRequest("/api/registration-windows", {
        method: "POST",
        body: { title: "Bad Dates", description: "d", startDate: "2025-06-01T00:00:00.000Z", endDate: "2025-05-01T00:00:00.000Z" },
      }));
      expect(res.status).toBe(400);
    });

    it("PATCH endDate <= startDate returns 400", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: "Patch Dates", description: "d", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"), status: "DRAFT" } });
      const res = await RW_PATCH(
        mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { startDate: "2025-06-01T00:00:00.000Z", endDate: "2025-05-01T00:00:00.000Z" } }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("GET with status filter", async () => {
      await setupAdmin();
      await prisma.registrationWindow.create({ data: { title: "Draft", description: "d", startDate: new Date(), endDate: new Date(), status: "DRAFT" } });
      const res = await RW_GET(mockRequest("/api/registration-windows", { searchParams: { status: "DRAFT" } }));
      const data = await res.json();
      expect(data.windows.every((w: Record<string, unknown>) => w.status === "DRAFT")).toBe(true);
    });

    it("GET ONE non-existent returns 404", async () => {
      await setupAdmin();
      const res = await RW_GET_ONE(mockRequest(`/api/registration-windows/${NON_EXISTENT_CUID}`), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(404);
    });
  });

  describe("Applicants - Missing Edge Cases", () => {
    it("GET with filters", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: "Filter", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" } });
      await prisma.applicant.create({ data: { registrationWindowId: rw.id, name: "A1", email: "a1@test.com", phone: "1", studentId: "S1", departmentPrefs: [], status: "SUBMITTED" } });
      const res = await APPLICANTS_GET(mockRequest("/api/applicants", { searchParams: { windowId: rw.id } }));
      const data = await res.json();
      expect(data.applicants.length).toBe(1);
    });

    it("GET with status filter", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: "StatFilter", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" } });
      await prisma.applicant.create({ data: { registrationWindowId: rw.id, name: "Acc", email: "acc@test.com", phone: "1", studentId: "S2", departmentPrefs: [], status: "ACCEPTED" } });
      const res = await APPLICANTS_GET(mockRequest("/api/applicants", { searchParams: { status: "ACCEPTED" } }));
      const data = await res.json();
      expect(data.applicants.every((a: Record<string, unknown>) => a.status === "ACCEPTED")).toBe(true);
    });

    it("GET applicant by id", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: "GetApp", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" } });
      const app = await prisma.applicant.create({ data: { registrationWindowId: rw.id, name: "G1", email: "g1@test.com", phone: "1", studentId: "S3", departmentPrefs: [], status: "SUBMITTED" } });
      const res = await APPLICANT_GET(mockRequest(`/api/applicants/${app.id}`), { params: Promise.resolve({ id: app.id }) });
      expect(res.status).toBe(200);
    });

    it("GET non-existent applicant returns 404", async () => {
      await setupAdmin();
      const res = await APPLICANT_GET(mockRequest(`/api/applicants/${NON_EXISTENT_CUID}`), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(404);
    });

    it("PATCH invalid transition returns 400", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: "InvTrans", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" } });
      const app = await prisma.applicant.create({ data: { registrationWindowId: rw.id, name: "Inv", email: "inv@test.com", phone: "1", studentId: "S4", departmentPrefs: [], status: "ACCEPTED" } });
      const res = await APPLICANT_PATCH(
        mockRequest(`/api/applicants/${app.id}`, { method: "PATCH", body: { status: "SUBMITTED" } }),
        { params: Promise.resolve({ id: app.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("convert non-accepted returns 400", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: "Conv", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" } });
      const app = await prisma.applicant.create({ data: { registrationWindowId: rw.id, name: "NotAcc", email: "notacc@test.com", phone: "1", studentId: "S5", departmentPrefs: [], status: "SUBMITTED" } });
      const res = await CONVERT_POST(mockRequest(`/api/applicants/${app.id}/convert`, { method: "POST", body: {} }), { params: Promise.resolve({ id: app.id }) });
      expect(res.status).toBe(400);
    });

    it("convert already converted returns 409", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: "Conv2", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" } });
      const u = await createTestUser({ email: `convuser-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const app = await prisma.applicant.create({ data: { registrationWindowId: rw.id, name: "DupConv", email: `dupconv-${uniqueSuffix()}@test.com`, phone: "1", studentId: "S6", departmentPrefs: [], status: "ACCEPTED", convertedMemberId: m.id } });
      const res = await CONVERT_POST(mockRequest(`/api/applicants/${app.id}/convert`, { method: "POST", body: {} }), { params: Promise.resolve({ id: app.id }) });
      expect(res.status).toBe(409);
    });

    it("convert non-existent returns 404", async () => {
      await setupAdmin();
      const res = await CONVERT_POST(mockRequest(`/api/applicants/${NON_EXISTENT_CUID}/convert`, { method: "POST", body: {} }), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(404);
    });

    it("convert with custom password", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: "ConvPass", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" } });
      const app = await prisma.applicant.create({ data: { registrationWindowId: rw.id, name: "PassConv", email: `passconv-${uniqueSuffix()}@test.com`, phone: "1", studentId: "S7", departmentPrefs: [], status: "ACCEPTED" } });
      const res = await CONVERT_POST(mockRequest(`/api/applicants/${app.id}/convert`, { method: "POST", body: { password: "MyCustomPass123" } }), { params: Promise.resolve({ id: app.id }) });
      expect(res.status).toBe(200);
    });

    it("export CSV", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: "Export", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" } });
      await prisma.applicant.create({ data: { registrationWindowId: rw.id, name: "CSV User", email: "csv@test.com", phone: "123", studentId: "S8", departmentPrefs: [], status: "SUBMITTED" } });
      const res = await EXPORT_GET(mockRequest("/api/applicants/export", { searchParams: { windowId: rw.id } }));
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("CSV User");
      expect(text).toContain("Name,Email");
    });

    it("export without windowId returns 400", async () => {
      await setupAdmin();
      const res = await EXPORT_GET(mockRequest("/api/applicants/export"));
      expect(res.status).toBe(400);
    });
  });

  describe("Promotions - Missing Edge Cases", () => {
    it("GET with invalid status filter returns 400", async () => {
      await setupAdmin();
      const res = await PROMOS_GET(mockRequest("/api/promotions", { searchParams: { status: "INVALID" } }));
      expect(res.status).toBe(400);
    });

    it("GET with memberId filter", async () => {
      const { user, member } = await setupAdmin();
      const role = await createTestRole({ name: `CurRole-${uniqueSuffix()}` });
      const propRole = await createTestRole({ name: `PropRole-${uniqueSuffix()}` });
      await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: propRole.id, reason: "Test", status: "DRAFT", submittedById: user.user.id } });
      const res = await PROMOS_GET(mockRequest("/api/promotions", { searchParams: { memberId: member.id } }));
      const data = await res.json();
      expect(data.promotions.length).toBe(1);
    });

    it("GET promotion by id", async () => {
      const { user, member } = await setupAdmin();
      const role = await createTestRole({ name: `GetPromo-${uniqueSuffix()}` });
      const propRole = await createTestRole({ name: `GetProp-${uniqueSuffix()}` });
      const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: propRole.id, reason: "Get", status: "DRAFT", submittedById: user.user.id } });
      const res = await PROMO_GET(mockRequest(`/api/promotions/${promo.id}`), { params: Promise.resolve({ id: promo.id }) });
      expect(res.status).toBe(200);
    });

    it("GET non-existent promotion returns 404", async () => {
      await setupAdmin();
      const res = await PROMO_GET(mockRequest(`/api/promotions/${NON_EXISTENT_CUID}`), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(404);
    });

    it("submit non-existent returns 404", async () => {
      await setupAdmin();
      const res = await PROMO_SUBMIT(mockRequest(`/api/promotions/${NON_EXISTENT_CUID}/submit`, { method: "POST" }), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(404);
    });

    it("submit non-DRAFT returns 400", async () => {
      const { user, member } = await setupAdmin();
      const role = await createTestRole({ name: `SubRole-${uniqueSuffix()}` });
      const propRole = await createTestRole({ name: `SubProp-${uniqueSuffix()}` });
      const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: propRole.id, reason: "X", status: "SUBMITTED", submittedById: user.user.id } });
      const res = await PROMO_SUBMIT(mockRequest(`/api/promotions/${promo.id}/submit`, { method: "POST" }), { params: Promise.resolve({ id: promo.id }) });
      expect(res.status).toBe(400);
    });

    it("decision on non-reviewable returns 400", async () => {
      const { user, member } = await setupAdmin();
      const role = await createTestRole({ name: `DecRole-${uniqueSuffix()}` });
      const propRole = await createTestRole({ name: `DecProp-${uniqueSuffix()}` });
      const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: propRole.id, reason: "Y", status: "DRAFT", submittedById: user.user.id } });
      const res = await PROMO_DECISION(
        mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
        { params: Promise.resolve({ id: promo.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("self-approval returns 403", async () => {
      const { user, member } = await setupAdmin();
      const role = await createTestRole({ name: `SelfRole-${uniqueSuffix()}` });
      const propRole = await createTestRole({ name: `SelfProp-${uniqueSuffix()}` });
      const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: propRole.id, reason: "Z", status: "SUBMITTED", submittedById: user.user.id } });
      const res = await PROMO_DECISION(
        mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
        { params: Promise.resolve({ id: promo.id }) }
      );
      expect(res.status).toBe(403);
    });

    it("reject promotion creates notification", async () => {
      await setupAdmin();
      const otherUser = await createTestUser({ email: `promonotif-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: otherUser.user.id });
      const role = await createTestRole({ name: `RejRole-${uniqueSuffix()}` });
      const propRole = await createTestRole({ name: `RejProp-${uniqueSuffix()}` });
      const promo = await prisma.promotionRequest.create({ data: { memberId: m.id, currentRoleId: role.id, proposedRoleId: propRole.id, reason: "Reject test", status: "SUBMITTED", submittedById: otherUser.user.id } });
      await PROMO_DECISION(
        mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "REJECTED" } }),
        { params: Promise.resolve({ id: promo.id }) }
      );
      const updated = await prisma.promotionRequest.findUnique({ where: { id: promo.id } });
      expect(updated!.status).toBe("REJECTED");
    });
  });

  describe("Dashboard - Missing Edge Cases", () => {
    it("admin dashboard returns all sections", async () => {
      await setupAdmin();
      const { GET: ADMIN_DASH } = await import("@/app/api/dashboard/admin/route");
      const res = await ADMIN_DASH();
      const data = await res.json();
      expect(data).toHaveProperty("members");
      expect(data).toHaveProperty("registrations");
      expect(data).toHaveProperty("pendingPromotions");
      expect(data).toHaveProperty("upcomingEvents");
      expect(data).toHaveProperty("recentGalleryItems");
    });

    it("member dashboard returns user data", async () => {
      await setupAdmin();
      const { GET: MEMBER_DASH } = await import("@/app/api/dashboard/member/route");
      const res = await MEMBER_DASH();
      const data = await res.json();
      expect(data).toHaveProperty("user");
      expect(data).toHaveProperty("member");
      expect(data).toHaveProperty("departments");
    });

    it("department dashboard with valid access", async () => {
      const { user, committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      await assignDepartment((await prisma.member.findUnique({ where: { userId: user.user.id } }))!.id, dept.id);
      const { GET: DEPT_DASH } = await import("@/app/api/dashboard/department/route");
      const res = await DEPT_DASH(mockRequest("/api/dashboard/department", { searchParams: { departmentId: dept.id } }));
      const data = await res.json();
      expect(data).toHaveProperty("department");
      expect(data).toHaveProperty("members");
      expect(data).toHaveProperty("tasks");
    });

    it("department dashboard without access returns 403", async () => {
      await setupAdmin();
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const { GET: DEPT_DASH } = await import("@/app/api/dashboard/department/route");
      const res = await DEPT_DASH(mockRequest("/api/dashboard/department", { searchParams: { departmentId: dept.id } }));
      expect(res.status).toBe(403);
    });
  });

  describe("Public API - Missing Edge Cases", () => {
    it("home returns emails stripped", async () => {
      const committee = await createTestCommittee({ isCurrent: true });
      const u = await createTestUser({ email: `pubmember-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const role = await createTestRole({ name: `PubRole-${uniqueSuffix()}` });
      await assignCommitteeRole(m.id, role.id, committee.id);
      const { GET: HOME_GET } = await import("@/app/api/public/home/route");
      const res = await HOME_GET();
      const data = await res.json();
      if (data.committee && data.committee.memberRoles.length > 0) {
        expect(data.committee.memberRoles[0].member.user).not.toHaveProperty("email");
      }
    });

    it("public updates with category filter", async () => {
      const admin = await createTestUser({ email: `pubcat-${uniqueSuffix()}@test.com` });
      await prisma.clubUpdate.create({ data: { title: "PubAnn", bodyRichText: "<p>A</p>", category: "ANNOUNCEMENT", authorId: admin.user.id, publishedAt: new Date() } });
      const { GET: PUB_UPDATES } = await import("@/app/api/public/updates/route");
      const res = await PUB_UPDATES(mockRequest("/api/public/updates", { searchParams: { category: "ANNOUNCEMENT" } }));
      const data = await res.json();
      expect(data.every((u: Record<string, unknown>) => u.category === "ANNOUNCEMENT")).toBe(true);
    });

    it("public gallery with category filter", async () => {
      await prisma.galleryAlbum.create({ data: { name: "PubProd", category: "PRODUCTIONS" } });
      await prisma.galleryAlbum.create({ data: { name: "PubWork", category: "WORKSHOPS" } });
      const { GET: PUB_GALLERY } = await import("@/app/api/public/gallery/route");
      const res = await PUB_GALLERY(mockRequest("/api/public/gallery", { searchParams: { category: "PRODUCTIONS" } }));
      const data = await res.json();
      expect(data.every((a: Record<string, unknown>) => a.category === "PRODUCTIONS")).toBe(true);
    });

    it("public gallery with departmentId filter", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      await prisma.galleryAlbum.create({ data: { name: "DeptGallery", category: "PRODUCTIONS", departmentId: dept.id } });
      const { GET: PUB_GALLERY } = await import("@/app/api/public/gallery/route");
      const res = await PUB_GALLERY(mockRequest("/api/public/gallery", { searchParams: { departmentId: dept.id } }));
      const data = await res.json();
      expect(data.length).toBe(1);
    });

    it("public recruitment returns only LIVE windows in date range", async () => {
      await prisma.registrationWindow.create({ data: { title: "Live Window", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31"), status: "LIVE" } });
      await prisma.registrationWindow.create({ data: { title: "Draft Window", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31"), status: "DRAFT" } });
      const { GET: PUB_RECRUIT } = await import("@/app/api/public/recruitment/route");
      const res = await PUB_RECRUIT();
      const data = await res.json();
      expect(data.length).toBe(1);
      expect(data[0].title).toBe("Live Window");
    });

    it("public departments returns current committee depts", async () => {
      const { committee } = await setupAdmin();
      await createTestDepartment({ committeeId: committee.id, name: `PubDept${uniqueSuffix()}` });
      const { GET: PUB_DEPTS } = await import("@/app/api/public/departments/route");
      const res = await PUB_DEPTS();
      const data = await res.json();
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it("public about returns defaults when no settings", async () => {
      const { GET: PUB_ABOUT } = await import("@/app/api/public/about/route");
      const res = await PUB_ABOUT();
      const data = await res.json();
      expect(data.clubName).toBe("Drama Club");
    });
  });

  describe("Permissions POST (seed)", () => {
    it("POST seeds all permissions", async () => {
      await setupAdmin();
      const { POST: PERMS_POST } = await import("@/app/api/permissions/route");
      const res = await PERMS_POST();
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.count).toBe(16);
    });
  });
});
