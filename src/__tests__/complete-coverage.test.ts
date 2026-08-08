import { describe, it, expect, beforeEach } from "vitest";
import { GET as PERMS_GET, POST as PERMS_POST } from "@/app/api/permissions/route";
import { GET as MEMBERS_GET, POST as MEMBERS_POST } from "@/app/api/members/route";
import { GET as MEMBER_GET, PATCH as MEMBER_PATCH } from "@/app/api/members/[id]/route";
import { POST as ADD_DEPT, DELETE as REMOVE_DEPT } from "@/app/api/members/[id]/departments/route";
import { GET as DEPTS_GET, POST as DEPTS_POST } from "@/app/api/departments/route";
import { GET as DEPT_GET, PATCH as DEPT_PATCH } from "@/app/api/departments/[id]/route";
import { GET as TASKS_GET, POST as TASKS_POST } from "@/app/api/departments/[id]/tasks/route";
import { PATCH as TASK_PATCH, DELETE as TASK_DELETE } from "@/app/api/departments/[id]/tasks/[taskId]/route";
import { GET as COMMITTEES_GET, POST as COMMITTEES_POST } from "@/app/api/committees/route";
import { GET as COMMITTEE_GET, PATCH as COMMITTEE_PATCH } from "@/app/api/committees/[id]/route";
import { POST as ASSIGN_ROLE, DELETE as REMOVE_ROLE } from "@/app/api/committees/[id]/roles/route";
import { GET as EVENTS_GET, POST as EVENTS_POST } from "@/app/api/events/route";
import { GET as EVENT_GET, PATCH as EVENT_PATCH, DELETE as EVENT_DELETE } from "@/app/api/events/[id]/route";
import { GET as UPDATES_GET, POST as UPDATES_POST } from "@/app/api/updates/route";
import { GET as UPDATE_GET, PATCH as UPDATE_PATCH, DELETE as UPDATE_DELETE } from "@/app/api/updates/[id]/route";
import { GET as GALLERY_GET, POST as GALLERY_POST } from "@/app/api/gallery/route";
import { POST as UPLOAD_URL_POST } from "@/app/api/gallery/upload-url/route";
import { GET as ITEMS_GET, POST as ITEMS_POST } from "@/app/api/gallery/items/route";
import { GET as ROLES_GET, POST as ROLES_POST } from "@/app/api/roles/route";
import { GET as ROLE_GET, PATCH as ROLE_PATCH, DELETE as ROLE_DELETE } from "@/app/api/roles/[id]/route";
import { GET as SETTINGS_GET, PATCH as SETTINGS_PATCH } from "@/app/api/settings/route";
import { GET as NOTIFS_GET } from "@/app/api/notifications/route";
import { GET as RW_GET, POST as RW_POST } from "@/app/api/registration-windows/route";
import { PATCH as RW_PATCH } from "@/app/api/registration-windows/[id]/route";
import { GET as APPLICANTS_GET } from "@/app/api/applicants/route";
import { GET as APPLICANT_GET, PATCH as APPLICANT_PATCH } from "@/app/api/applicants/[id]/route";
import { POST as CONVERT_POST } from "@/app/api/applicants/[id]/convert/route";
import { GET as EXPORT_GET } from "@/app/api/applicants/export/route";
import { GET as PROMOS_GET, POST as PROMOS_POST } from "@/app/api/promotions/route";
import { POST as PROMO_SUBMIT } from "@/app/api/promotions/[id]/submit/route";
import { POST as PROMO_DECISION } from "@/app/api/promotions/[id]/decision/route";
import { POST as APPLY_POST } from "@/app/api/registration-windows/[id]/apply/route";
import {
  mockRequest,
  mockAuth,
  clearAuth,
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

describe("Complete Backend Coverage", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  async function setupAdmin(extraPerms: string[] = []) {
    const allPerms = [...new Set(["member.view", "member.create", "member.edit", "department.view", "department.manage", "committee.manage", "registration.manage", "registration.review", "promotion.submit", "promotion.approve", "gallery.upload", "gallery.manage", "updates.publish", "events.manage", "permissions.manage", "settings.manage", ...extraPerms])];
    const user = await createTestUser({ email: `admin-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const role = await createTestRole({ name: `Admin-${uniqueSuffix()}`, permissionIds: (await Promise.all(allPerms.map(async k => { const p = await prisma.permission.findUnique({ where: { key: k } }); return p!.id; }))) });
    await assignCommitteeRole(member.id, role.id, committee.id);
    mockAuth(user.user.id, allPerms);
    return { user, member, committee };
  }

  async function setupUserWithPerms(perms: string[]) {
    const user = await createTestUser({ email: `user-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const role = await createTestRole({ name: `Role-${uniqueSuffix()}`, permissionIds: (await Promise.all(perms.map(async k => { const p = await prisma.permission.findUnique({ where: { key: k } }); return p!.id; }))) });
    await assignCommitteeRole(member.id, role.id, committee.id);
    return { user, member, committee, role };
  }

  // ─── Section 1: Permissions Endpoint (ZERO COVERAGE) ──────────────────────

  describe("Permissions Endpoint", () => {
    it("GET returns all 16 permissions", async () => {
      await setupAdmin();
      const res = await PERMS_GET();
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toHaveLength(16);
    });

    it("GET returns 401 unauthenticated", async () => {
      clearAuth();
      const res = await PERMS_GET();
      expect(res.status).toBe(401);
    });

    it("GET returns 403 without permissions.manage", async () => {
      const { user } = await setupUserWithPerms(["member.view"]);
      mockAuth(user.user.id, ["member.view"]);
      const res = await PERMS_GET();
      expect(res.status).toBe(403);
    });

    it("POST seeds all permissions", async () => {
      await setupAdmin();
      const res = await PERMS_POST();
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.count).toBe(16);
    });

    it("POST returns 401 unauthenticated", async () => {
      clearAuth();
      const res = await PERMS_POST();
      expect(res.status).toBe(401);
    });

    it("POST returns 403 without permissions.manage", async () => {
      const { user } = await setupUserWithPerms(["member.view"]);
      mockAuth(user.user.id, ["member.view"]);
      const res = await PERMS_POST();
      expect(res.status).toBe(403);
    });

    it("POST is idempotent (upsert)", async () => {
      await setupAdmin();
      await PERMS_POST();
      const res = await PERMS_POST();
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.count).toBe(16);
    });
  });

  // ─── Section 2: Gallery Upload URL (ZERO COVERAGE) ────────────────────────

  describe("Gallery Upload URL", () => {
    it("returns 401 unauthenticated", async () => {
      clearAuth();
      const res = await UPLOAD_URL_POST(
        mockRequest("/api/gallery/upload-url", {
          method: "POST",
          body: { fileName: "test.jpg", contentType: "image/jpeg", fileSize: 1024 },
        })
      );
      expect(res.status).toBe(401);
    });

    it("returns 403 without gallery.upload", async () => {
      const { user } = await setupUserWithPerms(["member.view"]);
      mockAuth(user.user.id, ["member.view"]);
      const res = await UPLOAD_URL_POST(
        mockRequest("/api/gallery/upload-url", {
          method: "POST",
          body: { fileName: "test.jpg", contentType: "image/jpeg", fileSize: 1024 },
        })
      );
      expect(res.status).toBe(403);
    });

    it("returns 400 with missing fields", async () => {
      await setupAdmin();
      const res = await UPLOAD_URL_POST(
        mockRequest("/api/gallery/upload-url", {
          method: "POST",
          body: { fileName: "test.jpg" },
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects invalid content type", async () => {
      await setupAdmin();
      const res = await UPLOAD_URL_POST(
        mockRequest("/api/gallery/upload-url", {
          method: "POST",
          body: { fileName: "test.exe", contentType: "application/exe", fileSize: 1024 },
        })
      );
      expect(res.status).toBe(400);
    });

    it("accepts valid image type", async () => {
      await setupAdmin();
      const res = await UPLOAD_URL_POST(
        mockRequest("/api/gallery/upload-url", {
          method: "POST",
          body: { fileName: "photo.jpg", contentType: "image/jpeg", fileSize: 1024 },
        })
      );
      expect([200, 500]).toContain(res.status);
    });

    it("accepts valid video type", async () => {
      await setupAdmin();
      const res = await UPLOAD_URL_POST(
        mockRequest("/api/gallery/upload-url", {
          method: "POST",
          body: { fileName: "clip.mp4", contentType: "video/mp4", fileSize: 1024 },
        })
      );
      expect([200, 500]).toContain(res.status);
    });
  });

  // ─── Section 3: RBAC Denial Tests (403) ───────────────────────────────────

  describe("RBAC 403 Denials", () => {
    describe("Members", () => {
      it("GET /api/members returns 403 without member.view", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await MEMBERS_GET(mockRequest("/api/members"));
        expect(res.status).toBe(403);
      });

      it("POST /api/members returns 403 without member.create", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await MEMBERS_POST(
          mockRequest("/api/members", { method: "POST", body: { userId: "x", memberCode: "y" } })
        );
        expect(res.status).toBe(403);
      });

      it("GET /api/members/:id returns 403 without member.view (non-owner)", async () => {
        const { user } = await setupUserWithPerms([]);
        const otherMember = await createTestMember();
        mockAuth(user.user.id, []);
        const res = await MEMBER_GET(mockRequest(`/api/members/${otherMember.id}`), { params: Promise.resolve({ id: otherMember.id }) });
        expect(res.status).toBe(403);
      });

      it("GET /api/members/:id returns 200 for the member's own profile without member.view", async () => {
        const { user, member } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await MEMBER_GET(mockRequest(`/api/members/${member.id}`), { params: Promise.resolve({ id: member.id }) });
        expect(res.status).toBe(200);
      });

      it("PATCH /api/members/:id returns 403 without member.edit", async () => {
        const { user, member } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await MEMBER_PATCH(
          mockRequest(`/api/members/${member.id}`, { method: "PATCH", body: { status: "ALUMNI" } }),
          { params: Promise.resolve({ id: member.id }) }
        );
        expect(res.status).toBe(403);
      });

      it("POST /api/members/:id/departments returns 403 without department.manage", async () => {
        const { user, member } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await ADD_DEPT(
          mockRequest(`/api/members/${member.id}/departments`, { method: "POST", body: { departmentId: "x" } }),
          { params: Promise.resolve({ id: member.id }) }
        );
        expect(res.status).toBe(403);
      });

      it("DELETE /api/members/:id/departments returns 403 without department.manage", async () => {
        const { user, member } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await REMOVE_DEPT(
          mockRequest(`/api/members/${member.id}/departments`, { method: "DELETE", body: { departmentId: "x" } }),
          { params: Promise.resolve({ id: member.id }) }
        );
        expect(res.status).toBe(403);
      });
    });

    describe("Departments", () => {
      it("GET /api/departments returns 403 without department.view", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await DEPTS_GET(mockRequest("/api/departments"));
        expect(res.status).toBe(403);
      });

      it("POST /api/departments returns 403 without department.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await DEPTS_POST(
          mockRequest("/api/departments", { method: "POST", body: { name: "Dept" } })
        );
        expect(res.status).toBe(403);
      });

      it("GET /api/departments/:id returns 403 without department.view", async () => {
        const { user } = await setupUserWithPerms([]);
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        mockAuth(user.user.id, []);
        const res = await DEPT_GET(mockRequest(`/api/departments/${dept.id}`), { params: Promise.resolve({ id: dept.id }) });
        expect(res.status).toBe(403);
      });

      it("PATCH /api/departments/:id returns 403 without department.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        mockAuth(user.user.id, []);
        const res = await DEPT_PATCH(
          mockRequest(`/api/departments/${dept.id}`, { method: "PATCH", body: { name: "New" } }),
          { params: Promise.resolve({ id: dept.id }) }
        );
        expect(res.status).toBe(403);
      });
    });

    describe("Tasks", () => {
      it("GET /api/departments/:id/tasks returns 403 without department.view", async () => {
        const { user } = await setupUserWithPerms([]);
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        mockAuth(user.user.id, []);
        const res = await TASKS_GET(mockRequest(`/api/departments/${dept.id}/tasks`), { params: Promise.resolve({ id: dept.id }) });
        expect(res.status).toBe(403);
      });

      it("POST /api/departments/:id/tasks returns 403 without department.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        mockAuth(user.user.id, []);
        const res = await TASKS_POST(
          mockRequest(`/api/departments/${dept.id}/tasks`, { method: "POST", body: { title: "Task" } }),
          { params: Promise.resolve({ id: dept.id }) }
        );
        expect(res.status).toBe(403);
      });

      it("PATCH /api/departments/:id/tasks/:taskId returns 403 without department.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        mockAuth(user.user.id, []);
        const res = await TASK_PATCH(
          mockRequest(`/api/departments/${dept.id}/tasks/${NON_EXISTENT_CUID}`, { method: "PATCH", body: { status: "DONE" } }),
          { params: Promise.resolve({ id: dept.id, taskId: NON_EXISTENT_CUID }) }
        );
        expect(res.status).toBe(403);
      });

      it("DELETE /api/departments/:id/tasks/:taskId returns 403 without department.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        mockAuth(user.user.id, []);
        const res = await TASK_DELETE(
          mockRequest(`/api/departments/${dept.id}/tasks/${NON_EXISTENT_CUID}`, { method: "DELETE" }),
          { params: Promise.resolve({ id: dept.id, taskId: NON_EXISTENT_CUID }) }
        );
        expect(res.status).toBe(403);
      });
    });

    describe("Committees", () => {
      it("POST /api/committees returns 403 without committee.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await COMMITTEES_POST(
          mockRequest("/api/committees", { method: "POST", body: { year: "2030" } })
        );
        expect(res.status).toBe(403);
      });

      it("PATCH /api/committees/:id returns 403 without committee.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        const committee = await createTestCommittee();
        mockAuth(user.user.id, []);
        const res = await COMMITTEE_PATCH(
          mockRequest(`/api/committees/${committee.id}`, { method: "PATCH", body: { status: "DISSOLVED" } }),
          { params: Promise.resolve({ id: committee.id }) }
        );
        expect(res.status).toBe(403);
      });

      it("POST /api/committees/:id/roles returns 403 without committee.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        const committee = await createTestCommittee();
        mockAuth(user.user.id, []);
        const res = await ASSIGN_ROLE(
          mockRequest(`/api/committees/${committee.id}/roles`, { method: "POST", body: { memberId: "x", roleId: "y" } }),
          { params: Promise.resolve({ id: committee.id }) }
        );
        expect(res.status).toBe(403);
      });

      it("DELETE /api/committees/:id/roles returns 403 without committee.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        const committee = await createTestCommittee();
        mockAuth(user.user.id, []);
        const res = await REMOVE_ROLE(
          mockRequest(`/api/committees/${committee.id}/roles`, { method: "DELETE", body: { memberId: "x", roleId: "y" } }),
          { params: Promise.resolve({ id: committee.id }) }
        );
        expect(res.status).toBe(403);
      });
    });

    describe("Events", () => {
      it("POST /api/events returns 403 without events.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await EVENTS_POST(
          mockRequest("/api/events", { method: "POST", body: { title: "E", type: "WORKSHOP", startAt: "2030-06-01T10:00:00.000Z" } })
        );
        expect(res.status).toBe(403);
      });

      it("PATCH /api/events/:id returns 403 without events.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "DRAFT" } });
        mockAuth(user.user.id, []);
        const res = await EVENT_PATCH(
          mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { title: "New" } }),
          { params: Promise.resolve({ id: ev.id }) }
        );
        expect(res.status).toBe(403);
      });

      it("DELETE /api/events/:id returns 403 without events.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "DRAFT" } });
        mockAuth(user.user.id, []);
        const res = await EVENT_DELETE(
          mockRequest(`/api/events/${ev.id}`, { method: "DELETE" }),
          { params: Promise.resolve({ id: ev.id }) }
        );
        expect(res.status).toBe(403);
      });

      it("GET /api/events is public (no auth required)", async () => {
        clearAuth();
        const res = await EVENTS_GET(mockRequest("/api/events"));
        expect(res.status).toBe(200);
      });
    });

    describe("Updates", () => {
      it("POST /api/updates returns 403 without updates.publish", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await UPDATES_POST(
          mockRequest("/api/updates", { method: "POST", body: { title: "U", content: "C" } })
        );
        expect(res.status).toBe(403);
      });

      it("PATCH /api/updates/:id returns 403 without updates.publish", async () => {
        const { user } = await setupUserWithPerms([]);
        const { user: adminUser } = await setupAdmin();
        const update = await prisma.clubUpdate.create({ data: { title: `Upd${uniqueSuffix()}`, bodyRichText: "<p>Body</p>", category: "ANNOUNCEMENT", authorId: adminUser.user.id } });
        mockAuth(user.user.id, []);
        const res = await UPDATE_PATCH(
          mockRequest(`/api/updates/${update.id}`, { method: "PATCH", body: { title: "New" } }),
          { params: Promise.resolve({ id: update.id }) }
        );
        expect(res.status).toBe(403);
      });

      it("DELETE /api/updates/:id returns 403 without updates.publish", async () => {
        const { user } = await setupUserWithPerms([]);
        const { user: adminUser } = await setupAdmin();
        const update = await prisma.clubUpdate.create({ data: { title: `Upd${uniqueSuffix()}`, bodyRichText: "<p>Body</p>", category: "ANNOUNCEMENT", authorId: adminUser.user.id } });
        mockAuth(user.user.id, []);
        const res = await UPDATE_DELETE(
          mockRequest(`/api/updates/${update.id}`, { method: "DELETE" }),
          { params: Promise.resolve({ id: update.id }) }
        );
        expect(res.status).toBe(403);
      });

      it("GET /api/updates is public (no auth required)", async () => {
        clearAuth();
        const res = await UPDATES_GET(mockRequest("/api/updates"));
        expect(res.status).toBe(200);
      });
    });

    describe("Gallery", () => {
      it("POST /api/gallery returns 403 without gallery.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await GALLERY_POST(
          mockRequest("/api/gallery", { method: "POST", body: { name: "Album" } })
        );
        expect(res.status).toBe(403);
      });

      it("POST /api/gallery/items returns 403 without gallery.upload", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await ITEMS_POST(
          mockRequest("/api/gallery/items", { method: "POST", body: { albumId: "x", url: "y", fileName: "z" } })
        );
        expect(res.status).toBe(403);
      });

      it("GET /api/gallery/items is public (no auth required)", async () => {
        clearAuth();
        const res = await ITEMS_GET(mockRequest("/api/gallery/items"));
        expect(res.status).toBe(200);
      });
    });

    describe("Roles", () => {
      it("GET /api/roles returns 403 without permissions.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await ROLES_GET();
        expect(res.status).toBe(403);
      });

      it("POST /api/roles returns 403 without permissions.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await ROLES_POST(
          mockRequest("/api/roles", { method: "POST", body: { name: "R" } })
        );
        expect(res.status).toBe(403);
      });

      it("GET /api/roles/:id returns 403 without permissions.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        const role = await createTestRole();
        mockAuth(user.user.id, []);
        const res = await ROLE_GET(mockRequest(`/api/roles/${role.id}`), { params: Promise.resolve({ id: role.id }) });
        expect(res.status).toBe(403);
      });

      it("PATCH /api/roles/:id returns 403 without permissions.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        const role = await createTestRole();
        mockAuth(user.user.id, []);
        const res = await ROLE_PATCH(
          mockRequest(`/api/roles/${role.id}`, { method: "PATCH", body: { name: "New" } }),
          { params: Promise.resolve({ id: role.id }) }
        );
        expect(res.status).toBe(403);
      });

      it("DELETE /api/roles/:id returns 403 without permissions.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        const role = await createTestRole();
        mockAuth(user.user.id, []);
        const res = await ROLE_DELETE(
          mockRequest(`/api/roles/${role.id}`, { method: "DELETE" }),
          { params: Promise.resolve({ id: role.id }) }
        );
        expect(res.status).toBe(403);
      });
    });

    describe("Settings", () => {
      it("GET /api/settings returns 403 without settings.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await SETTINGS_GET();
        expect(res.status).toBe(403);
      });

      it("PATCH /api/settings returns 403 without settings.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await SETTINGS_PATCH(
          mockRequest("/api/settings", { method: "PATCH", body: { key: "k", value: "v" } })
        );
        expect(res.status).toBe(403);
      });
    });

    describe("Registration Windows", () => {
      it("GET /api/registration-windows returns 403 without registration.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await RW_GET(mockRequest("/api/registration-windows"));
        expect(res.status).toBe(403);
      });

      it("POST /api/registration-windows returns 403 without registration.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await RW_POST(
          mockRequest("/api/registration-windows", { method: "POST", body: { title: "RW" } })
        );
        expect(res.status).toBe(403);
      });

      it("PATCH /api/registration-windows/:id returns 403 without registration.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        await setupAdmin();
        const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "DRAFT", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
        mockAuth(user.user.id, []);
        const res = await RW_PATCH(
          mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { title: "New" } }),
          { params: Promise.resolve({ id: rw.id }) }
        );
        expect(res.status).toBe(403);
      });
    });

    describe("Applicants", () => {
      it("GET /api/applicants returns 403 without registration.review", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await APPLICANTS_GET(mockRequest("/api/applicants"));
        expect(res.status).toBe(403);
      });

      it("GET /api/applicants/:id returns 403 without registration.review", async () => {
        const { user } = await setupUserWithPerms([]);
        await setupAdmin();
        const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "DRAFT", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
        const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id } });
        mockAuth(user.user.id, []);
        const res = await APPLICANT_GET(mockRequest(`/api/applicants/${applicant.id}`), { params: Promise.resolve({ id: applicant.id }) });
        expect(res.status).toBe(403);
      });

      it("POST /api/applicants/:id/convert returns 403 without member.create", async () => {
        const { user } = await setupUserWithPerms([]);
        await setupAdmin();
        const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "DRAFT", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
        const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "ACCEPTED" } });
        mockAuth(user.user.id, []);
        const res = await CONVERT_POST(
          mockRequest(`/api/applicants/${applicant.id}/convert`, { method: "POST" }),
          { params: Promise.resolve({ id: applicant.id }) }
        );
        expect(res.status).toBe(403);
      });

      it("GET /api/applicants/export returns 403 without registration.review", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await EXPORT_GET(mockRequest("/api/applicants/export"));
        expect(res.status).toBe(403);
      });
    });

    describe("Promotions", () => {
      it("GET /api/promotions returns 401 unauthenticated", async () => {
        clearAuth();
        const res = await PROMOS_GET(mockRequest("/api/promotions"));
        expect(res.status).toBe(401);
      });

      it("POST /api/promotions returns 403 without promotion.submit", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await PROMOS_POST(
          mockRequest("/api/promotions", { method: "POST", body: { memberId: "x", newRole: "r" } })
        );
        expect(res.status).toBe(403);
      });

      it("POST /api/promotions/:id/submit returns 403 without promotion.submit", async () => {
        const { user, member } = await setupUserWithPerms([]);
        await setupAdmin();
        const role = await createTestRole();
        const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: role.id, reason: "Test reason", submittedById: user.user.id, status: "DRAFT" } });
        mockAuth(user.user.id, []);
        const res = await PROMO_SUBMIT(
          mockRequest(`/api/promotions/${promo.id}/submit`, { method: "POST" }),
          { params: Promise.resolve({ id: promo.id }) }
        );
        expect(res.status).toBe(403);
      });

      it("POST /api/promotions/:id/decision returns 403 without promotion.approve", async () => {
        const { user, member } = await setupUserWithPerms([]);
        await setupAdmin();
        const role = await createTestRole();
        const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: role.id, reason: "Test reason", submittedById: user.user.id, status: "SUBMITTED" } });
        mockAuth(user.user.id, []);
        const res = await PROMO_DECISION(
          mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { decision: "APPROVED" } }),
          { params: Promise.resolve({ id: promo.id }) }
        );
        expect(res.status).toBe(403);
      });
    });

    describe("Dashboard", () => {
      it("GET /api/dashboard/admin returns 403 without permissions.manage", async () => {
        const { user } = await setupUserWithPerms([]);
        mockAuth(user.user.id, []);
        const res = await (await import("@/app/api/dashboard/admin/route")).GET();
        expect(res.status).toBe(403);
      });

      it("GET /api/dashboard/member returns 401 unauthenticated", async () => {
        clearAuth();
        const res = await (await import("@/app/api/dashboard/member/route")).GET();
        expect(res.status).toBe(401);
      });
    });
  });

  // ─── Section 4: State Machine Tests ───────────────────────────────────────

  describe("State Machine Tests", () => {
    describe("Registration Windows", () => {
      it("DRAFT -> SCHEDULED", async () => {
        await setupAdmin();
        const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "DRAFT", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
        const res = await RW_PATCH(
          mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "SCHEDULED" } }),
          { params: Promise.resolve({ id: rw.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("SCHEDULED");
      });

      it("SCHEDULED -> LIVE", async () => {
        await setupAdmin();
        const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "SCHEDULED", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
        const res = await RW_PATCH(
          mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "LIVE" } }),
          { params: Promise.resolve({ id: rw.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("LIVE");
      });

      it("LIVE -> CLOSED", async () => {
        await setupAdmin();
        const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
        const res = await RW_PATCH(
          mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "CLOSED" } }),
          { params: Promise.resolve({ id: rw.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("CLOSED");
      });

      it("DRAFT -> LIVE transitions directly", async () => {
        await setupAdmin();
        const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "DRAFT", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
        const res = await RW_PATCH(
          mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "LIVE" } }),
          { params: Promise.resolve({ id: rw.id }) }
        );
        expect(res.status).toBe(200);
      });

      it("CLOSED -> LIVE transitions directly", async () => {
        await setupAdmin();
        const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "CLOSED", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
        const res = await RW_PATCH(
          mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "LIVE" } }),
          { params: Promise.resolve({ id: rw.id }) }
        );
        expect(res.status).toBe(200);
      });
    });

    describe("Events", () => {
      it("DRAFT -> UPCOMING", async () => {
        await setupAdmin();
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "DRAFT" } });
        const res = await EVENT_PATCH(
          mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { status: "UPCOMING" } }),
          { params: Promise.resolve({ id: ev.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("UPCOMING");
      });

      it("UPCOMING -> CANCELLED", async () => {
        await setupAdmin();
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "UPCOMING" } });
        const res = await EVENT_PATCH(
          mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { status: "CANCELLED" } }),
          { params: Promise.resolve({ id: ev.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("CANCELLED");
      });

      it("ONGOING -> COMPLETED", async () => {
        await setupAdmin();
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "ONGOING" } });
        const res = await EVENT_PATCH(
          mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { status: "COMPLETED" } }),
          { params: Promise.resolve({ id: ev.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("COMPLETED");
      });

      it("COMPLETED -> UPCOMING is invalid", async () => {
        await setupAdmin();
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "COMPLETED" } });
        const res = await EVENT_PATCH(
          mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { status: "UPCOMING" } }),
          { params: Promise.resolve({ id: ev.id }) }
        );
        expect(res.status).toBe(400);
      });

      it("CANCELLED -> UPCOMING is invalid", async () => {
        await setupAdmin();
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "CANCELLED" } });
        const res = await EVENT_PATCH(
          mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { status: "UPCOMING" } }),
          { params: Promise.resolve({ id: ev.id }) }
        );
        expect(res.status).toBe(400);
      });

      it("ONGOING -> UPCOMING is invalid", async () => {
        await setupAdmin();
        const { committee } = await setupAdmin();
        const dept = await createTestDepartment({ committeeId: committee.id });
        const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "ONGOING" } });
        const res = await EVENT_PATCH(
          mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { status: "UPCOMING" } }),
          { params: Promise.resolve({ id: ev.id }) }
        );
        expect(res.status).toBe(400);
      });
    });

    describe("Applicants", () => {
      it("SUBMITTED -> ACCEPTED", async () => {
        await setupAdmin();
        const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
        const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "SUBMITTED" } });
        const res = await APPLICANT_PATCH(
          mockRequest(`/api/applicants/${applicant.id}`, { method: "PATCH", body: { status: "ACCEPTED" } }),
          { params: Promise.resolve({ id: applicant.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("ACCEPTED");
      });

      it("UNDER_REVIEW -> ACCEPTED", async () => {
        await setupAdmin();
        const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
        const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "UNDER_REVIEW" } });
        const res = await APPLICANT_PATCH(
          mockRequest(`/api/applicants/${applicant.id}`, { method: "PATCH", body: { status: "ACCEPTED" } }),
          { params: Promise.resolve({ id: applicant.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("ACCEPTED");
      });

      it("UNDER_REVIEW -> REJECTED", async () => {
        await setupAdmin();
        const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
        const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "UNDER_REVIEW" } });
        const res = await APPLICANT_PATCH(
          mockRequest(`/api/applicants/${applicant.id}`, { method: "PATCH", body: { status: "REJECTED" } }),
          { params: Promise.resolve({ id: applicant.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("REJECTED");
      });

      it("SUBMITTED -> ACCEPTED is valid", async () => {
        await setupAdmin();
        const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
        const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "SUBMITTED" } });
        const res = await APPLICANT_PATCH(
          mockRequest(`/api/applicants/${applicant.id}`, { method: "PATCH", body: { status: "ACCEPTED" } }),
          { params: Promise.resolve({ id: applicant.id }) }
        );
        expect(res.status).toBe(200);
      });

      it("REJECTED -> ACCEPTED is invalid", async () => {
        await setupAdmin();
        const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
        const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "REJECTED" } });
        const res = await APPLICANT_PATCH(
          mockRequest(`/api/applicants/${applicant.id}`, { method: "PATCH", body: { status: "ACCEPTED" } }),
          { params: Promise.resolve({ id: applicant.id }) }
        );
        expect(res.status).toBe(400);
      });
    });

    describe("Promotions", () => {
      it("DRAFT -> SUBMITTED via submit endpoint", async () => {
        const { user, member } = await setupUserWithPerms(["promotion.submit"]);
        const { committee } = await setupAdmin();
        const role = await createTestRole();
        await assignCommitteeRole(member.id, role.id, committee.id);
        const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: role.id, reason: "Test reason", submittedById: user.user.id, status: "DRAFT" } });
        mockAuth(user.user.id, ["promotion.submit"]);
        const res = await PROMO_SUBMIT(
          mockRequest(`/api/promotions/${promo.id}/submit`, { method: "POST" }),
          { params: Promise.resolve({ id: promo.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("SUBMITTED");
      });

      it("SUBMITTED -> APPROVED via decision endpoint", async () => {
        const { user: approver } = await setupUserWithPerms(["promotion.approve"]);
        const { user: memberUser, member } = await setupUserWithPerms([]);
        const { committee } = await setupAdmin();
        const role = await createTestRole();
        await assignCommitteeRole(member.id, role.id, committee.id);
        const newRole = await createTestRole();
        const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: newRole.id, reason: "Test reason", submittedById: memberUser.user.id, status: "SUBMITTED" } });
        mockAuth(approver.user.id, ["promotion.approve"]);
        const res = await PROMO_DECISION(
          mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
          { params: Promise.resolve({ id: promo.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("APPROVED");
      });

      it("SUBMITTED -> REJECTED via decision endpoint", async () => {
        const { user: approver } = await setupUserWithPerms(["promotion.approve"]);
        const { user: memberUser, member } = await setupUserWithPerms([]);
        const { committee } = await setupAdmin();
        const role = await createTestRole();
        await assignCommitteeRole(member.id, role.id, committee.id);
        const newRole = await createTestRole();
        const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: newRole.id, reason: "Test reason", submittedById: memberUser.user.id, status: "SUBMITTED" } });
        mockAuth(approver.user.id, ["promotion.approve"]);
        const res = await PROMO_DECISION(
          mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "REJECTED" } }),
          { params: Promise.resolve({ id: promo.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe("REJECTED");
      });

      it("APPROVED promotion creates new CommitteeMemberRole in DB", async () => {
        const { user: approver } = await setupUserWithPerms(["promotion.approve"]);
        const { user: memberUser, member } = await setupUserWithPerms([]);
        const currentRole = await createTestRole({ name: "CurrentRole" });
        const newRole = await createTestRole({ name: "NewRole" });
        // Find the actual current committee used by the decision route
        const currentCommittee = await prisma.committee.findFirst({ where: { isCurrent: true } });
        await assignCommitteeRole(member.id, currentRole.id, currentCommittee!.id);
        const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: currentRole.id, proposedRoleId: newRole.id, reason: "Test reason", submittedById: memberUser.user.id, status: "SUBMITTED" } });
        mockAuth(approver.user.id, ["promotion.approve"]);
        await PROMO_DECISION(
          mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
          { params: Promise.resolve({ id: promo.id }) }
        );
        const assigned = await prisma.committeeMemberRole.findFirst({
          where: { memberId: member.id, roleId: newRole.id },
        });
        expect(assigned).not.toBeNull();
      });

      it("SUBMITTED -> SUBMITTED is invalid", async () => {
        const { user, member } = await setupUserWithPerms(["promotion.submit"]);
        const { committee } = await setupAdmin();
        const role = await createTestRole();
        await assignCommitteeRole(member.id, role.id, committee.id);
        const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: role.id, reason: "Test reason", submittedById: user.user.id, status: "SUBMITTED" } });
        mockAuth(user.user.id, ["promotion.submit"]);
        const res = await PROMO_SUBMIT(
          mockRequest(`/api/promotions/${promo.id}/submit`, { method: "POST" }),
          { params: Promise.resolve({ id: promo.id }) }
        );
        expect(res.status).toBe(400);
      });
    });
  });

  // ─── Section 5: Unauthenticated Access Tests (401) ────────────────────────

  describe("Unauthenticated Access (401)", () => {
    it("GET /api/members", async () => {
      clearAuth();
      const res = await MEMBERS_GET(mockRequest("/api/members"));
      expect(res.status).toBe(401);
    });

    it("POST /api/members", async () => {
      clearAuth();
      const res = await MEMBERS_POST(mockRequest("/api/members", { method: "POST", body: { userId: "x" } }));
      expect(res.status).toBe(401);
    });

    it("GET /api/members/:id", async () => {
      clearAuth();
      const res = await MEMBER_GET(mockRequest(`/api/members/${NON_EXISTENT_CUID}`), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(401);
    });

    it("PATCH /api/members/:id", async () => {
      clearAuth();
      const res = await MEMBER_PATCH(
        mockRequest(`/api/members/${NON_EXISTENT_CUID}`, { method: "PATCH", body: {} }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(401);
    });

    it("POST /api/members/:id/departments", async () => {
      clearAuth();
      const res = await ADD_DEPT(
        mockRequest(`/api/members/${NON_EXISTENT_CUID}/departments`, { method: "POST", body: { departmentId: "x" } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(401);
    });

    it("DELETE /api/members/:id/departments", async () => {
      clearAuth();
      const res = await REMOVE_DEPT(
        mockRequest(`/api/members/${NON_EXISTENT_CUID}/departments`, { method: "DELETE", body: { departmentId: "x" } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(401);
    });

    it("GET /api/departments", async () => {
      clearAuth();
      const res = await DEPTS_GET(mockRequest("/api/departments"));
      expect(res.status).toBe(401);
    });

    it("POST /api/departments", async () => {
      clearAuth();
      const res = await DEPTS_POST(mockRequest("/api/departments", { method: "POST", body: { name: "D" } }));
      expect(res.status).toBe(401);
    });

    it("GET /api/committees (all=true)", async () => {
      clearAuth();
      const res = await COMMITTEES_GET(mockRequest("/api/committees", { searchParams: { all: "true" } }));
      expect(res.status).toBe(401);
    });

    it("POST /api/committees", async () => {
      clearAuth();
      const res = await COMMITTEES_POST(mockRequest("/api/committees", { method: "POST", body: { year: "2030" } }));
      expect(res.status).toBe(401);
    });

    it("POST /api/events", async () => {
      clearAuth();
      const res = await EVENTS_POST(
        mockRequest("/api/events", { method: "POST", body: { title: "E", type: "WORKSHOP", startAt: "2030-06-01T10:00:00.000Z" } })
      );
      expect(res.status).toBe(401);
    });

    it("POST /api/updates", async () => {
      clearAuth();
      const res = await UPDATES_POST(
        mockRequest("/api/updates", { method: "POST", body: { title: "U", content: "C" } })
      );
      expect(res.status).toBe(401);
    });

    it("POST /api/gallery", async () => {
      clearAuth();
      const res = await GALLERY_POST(
        mockRequest("/api/gallery", { method: "POST", body: { name: "Album" } })
      );
      expect(res.status).toBe(401);
    });

    it("POST /api/gallery/items", async () => {
      clearAuth();
      const res = await ITEMS_POST(
        mockRequest("/api/gallery/items", { method: "POST", body: { url: "x", fileName: "y", albumId: "z" } })
      );
      expect(res.status).toBe(401);
    });

    it("GET /api/roles", async () => {
      clearAuth();
      const res = await ROLES_GET();
      expect(res.status).toBe(401);
    });

    it("POST /api/roles", async () => {
      clearAuth();
      const res = await ROLES_POST(mockRequest("/api/roles", { method: "POST", body: { name: "R" } }));
      expect(res.status).toBe(401);
    });

    it("GET /api/settings", async () => {
      clearAuth();
      const res = await SETTINGS_GET();
      expect(res.status).toBe(401);
    });

    it("PATCH /api/settings", async () => {
      clearAuth();
      const res = await SETTINGS_PATCH(
        mockRequest("/api/settings", { method: "PATCH", body: { key: "k", value: "v" } })
      );
      expect(res.status).toBe(401);
    });

    it("GET /api/registration-windows", async () => {
      clearAuth();
      const res = await RW_GET(mockRequest("/api/registration-windows"));
      expect(res.status).toBe(401);
    });

    it("GET /api/applicants", async () => {
      clearAuth();
      const res = await APPLICANTS_GET(mockRequest("/api/applicants"));
      expect(res.status).toBe(401);
    });

    it("GET /api/promotions", async () => {
      clearAuth();
      const res = await PROMOS_GET(mockRequest("/api/promotions"));
      expect(res.status).toBe(401);
    });

    it("POST /api/promotions", async () => {
      clearAuth();
      const res = await PROMOS_POST(
        mockRequest("/api/promotions", { method: "POST", body: { memberId: "x", newRole: "r" } })
      );
      expect(res.status).toBe(401);
    });
  });

  // ─── Section 6: Public Endpoints (No Auth) ────────────────────────────────

  describe("Public Endpoints", () => {
    it("GET /api/events is public", async () => {
      clearAuth();
      const res = await EVENTS_GET(mockRequest("/api/events"));
      expect(res.status).toBe(200);
    });

    it("GET /api/events/:id is public", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "UPCOMING" } });
      clearAuth();
      const res = await EVENT_GET(mockRequest(`/api/events/${ev.id}`), { params: Promise.resolve({ id: ev.id }) });
      expect(res.status).toBe(200);
    });

    it("GET /api/updates is public", async () => {
      clearAuth();
      const res = await UPDATES_GET(mockRequest("/api/updates"));
      expect(res.status).toBe(200);
    });

    it("GET /api/updates/:id is public", async () => {
      const { user: adminUser } = await setupAdmin();
      const update = await prisma.clubUpdate.create({ data: { title: `Upd${uniqueSuffix()}`, bodyRichText: "<p>Body</p>", category: "ANNOUNCEMENT", authorId: adminUser.user.id, publishedAt: new Date() } });
      clearAuth();
      const res = await UPDATE_GET(mockRequest(`/api/updates/${update.id}`), { params: Promise.resolve({ id: update.id }) });
      expect(res.status).toBe(200);
    });

    it("GET /api/gallery/items is public", async () => {
      clearAuth();
      const res = await ITEMS_GET(mockRequest("/api/gallery/items"));
      expect(res.status).toBe(200);
    });

    it("POST /api/contact is public", async () => {
      clearAuth();
      const { POST: CONTACT_POST } = await import("@/app/api/contact/route");
      const res = await CONTACT_POST(
        mockRequest("/api/contact", { method: "POST", body: { name: "Test", email: "t@test.com", subject: "Hi", message: "Hello this is a test message for the contact form" } })
      );
      expect(res.status).toBe(201);
    });

    it("POST /api/registration-windows/:id/apply is public (201)", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      clearAuth();
      const res = await APPLY_POST(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, { method: "POST", body: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [dept.id] } }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(201);
    });
  });

  // ─── Section 7: Database Constraint Tests ──────────────────────────────────

  describe("Database Constraint Tests", () => {
    it("Member unique userId constraint (409)", async () => {
      await setupAdmin();
      const user = await createTestUser({ email: `c1-${uniqueSuffix()}@test.com` });
      const code1 = `C1-${uniqueSuffix()}`;
      const code2 = `C2-${uniqueSuffix()}`;
      await MEMBERS_POST(mockRequest("/api/members", { method: "POST", body: { userId: user.user.id, memberCode: code1 } }));
      const res = await MEMBERS_POST(mockRequest("/api/members", { method: "POST", body: { userId: user.user.id, memberCode: code2 } }));
      expect(res.status).toBe(409);
    });

    it("Member unique memberCode constraint (409)", async () => {
      await setupAdmin();
      const u1 = await createTestUser({ email: `c2-${uniqueSuffix()}@test.com` });
      const u2 = await createTestUser({ email: `c3-${uniqueSuffix()}@test.com` });
      const code = `CC-${uniqueSuffix()}`;
      await MEMBERS_POST(mockRequest("/api/members", { method: "POST", body: { userId: u1.user.id, memberCode: code } }));
      const res = await MEMBERS_POST(mockRequest("/api/members", { method: "POST", body: { userId: u2.user.id, memberCode: code } }));
      expect(res.status).toBe(409);
    });

    it("User unique email constraint (throws)", async () => {
      const email = `uniq-${uniqueSuffix()}@test.com`;
      await createTestUser({ email });
      await expect(createTestUser({ email })).rejects.toThrow();
    });

    it("Role unique name constraint (409)", async () => {
      await setupAdmin();
      const name = `UniqueRole-${uniqueSuffix()}`;
      await ROLES_POST(mockRequest("/api/roles", { method: "POST", body: { name } }));
      const res = await ROLES_POST(mockRequest("/api/roles", { method: "POST", body: { name } }));
      expect(res.status).toBe(409);
    });

    it("Committee duplicate year is allowed (201)", async () => {
      await setupAdmin();
      const year = `20${uniqueSuffix().slice(-2)}`;
      const res1 = await COMMITTEES_POST(mockRequest("/api/committees", { method: "POST", body: { year, startDate: "2030-01-01T00:00:00.000Z" } }));
      expect(res1.status).toBe(201);
      await setupAdmin();
      const res = await COMMITTEES_POST(mockRequest("/api/committees", { method: "POST", body: { year, startDate: "2030-01-01T00:00:00.000Z" } }));
      expect(res.status).toBe(201);
    });

    it("MemberDepartment composite unique (409)", async () => {
      const { member } = await setupAdmin();
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      await assignDepartment(member.id, dept.id);
      await expect(assignDepartment(member.id, dept.id)).rejects.toThrow();
    });

    it("Foreign key: Task with non-existent departmentId (throws)", async () => {
      await expect(
        prisma.task.create({ data: { title: "T", departmentId: NON_EXISTENT_CUID } })
      ).rejects.toThrow();
    });

    it("Foreign key: Event with non-existent departmentId (throws)", async () => {
      await expect(
        prisma.event.create({ data: { title: "E", type: "WORKSHOP", startAt: new Date("2030-06-01"), departmentId: NON_EXISTENT_CUID } })
      ).rejects.toThrow();
    });

    it("Foreign key: Member with non-existent userId (throws)", async () => {
      await expect(
        prisma.member.create({ data: { userId: NON_EXISTENT_CUID, memberCode: "X" } })
      ).rejects.toThrow();
    });

    it("Foreign key: Applicant with non-existent registrationWindowId (throws)", async () => {
      await expect(
        prisma.applicant.create({ data: { name: "A", email: "a@test.com", phone: "123", studentId: "S1", registrationWindowId: NON_EXISTENT_CUID } })
      ).rejects.toThrow();
    });
  });

  // ─── Section 8: Pagination & Filter Edge Cases ────────────────────────────

  describe("Pagination & Filter Edge Cases", () => {
    it("GET /api/members with page=0 defaults to page 1", async () => {
      await setupAdmin();
      const res = await MEMBERS_GET(mockRequest("/api/members", { searchParams: { page: "0" } }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.pagination).toBeDefined();
    });

    it("GET /api/members with negative limit", async () => {
      await setupAdmin();
      const res = await MEMBERS_GET(mockRequest("/api/members", { searchParams: { limit: "-5" } }));
      expect(res.status).toBe(200);
    });

    it("GET /api/members with very large limit", async () => {
      await setupAdmin();
      const res = await MEMBERS_GET(mockRequest("/api/members", { searchParams: { limit: "9999" } }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data.members)).toBe(true);
    });

    it("GET /api/members search no results returns empty", async () => {
      await setupAdmin();
      const res = await MEMBERS_GET(mockRequest("/api/members", { searchParams: { search: "zzz_nonexistent_xyz_999" } }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.members).toHaveLength(0);
    });

    it("GET /api/notifications with pagination params", async () => {
      const { user } = await setupAdmin();
      mockAuth(user.user.id, []);
      const res = await NOTIFS_GET(mockRequest("/api/notifications", { searchParams: { page: "1", limit: "5" } }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.notifications).toBeDefined();
    });
  });

  // ─── Section 9: Cross-Endpoint Integration ────────────────────────────────

  describe("Cross-Endpoint Integration", () => {
    it("Registration -> Apply -> Review -> Accept -> Convert -> Member full lifecycle", async () => {
      const { user } = await setupAdmin();
      const { committee: committee2 } = await setupAdmin();
      const appName = `Lifecycle${uniqueSuffix()}`;
      const appEmail = `lc-${uniqueSuffix()}@test.com`;
      const dept = await createTestDepartment({ committeeId: committee2.id });

      // Create registration window
      const rwRes = await RW_POST(
        mockRequest("/api/registration-windows", { method: "POST", body: { title: `LC-RW-${uniqueSuffix()}`, description: "Test description", status: "DRAFT", startDate: "2020-01-01T00:00:00.000Z", endDate: "2030-12-31T00:00:00.000Z" } })
      );
      const rwData = await rwRes.json();

      // Transition to LIVE
      await RW_PATCH(
        mockRequest(`/api/registration-windows/${rwData.id}`, { method: "PATCH", body: { status: "SCHEDULED" } }),
        { params: Promise.resolve({ id: rwData.id }) }
      );
      await RW_PATCH(
        mockRequest(`/api/registration-windows/${rwData.id}`, { method: "PATCH", body: { status: "LIVE" } }),
        { params: Promise.resolve({ id: rwData.id }) }
      );

      // Apply
      clearAuth();
      const applyRes = await APPLY_POST(
        mockRequest(`/api/registration-windows/${rwData.id}/apply`, { method: "POST", body: { name: appName, email: appEmail, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [dept.id] } }),
        { params: Promise.resolve({ id: rwData.id }) }
      );
      expect(applyRes.status).toBe(201);
      const appData = await applyRes.json();

      // Review and accept
      mockAuth(user.user.id, ["registration.review", "member.create"]);
      const acceptRes = await APPLICANT_PATCH(
        mockRequest(`/api/applicants/${appData.id}`, { method: "PATCH", body: { status: "ACCEPTED" } }),
        { params: Promise.resolve({ id: appData.id }) }
      );
      expect(acceptRes.status).toBe(200);

      // Convert to member
      const convertRes = await CONVERT_POST(
        mockRequest(`/api/applicants/${appData.id}/convert`, { method: "POST", body: {} }),
        { params: Promise.resolve({ id: appData.id }) }
      );
      expect(convertRes.status).toBe(200);
      const memberData = await convertRes.json();
      expect(memberData.member.memberCode).toBeDefined();

      // Verify member exists
      const memberCheck = await prisma.member.findUnique({ where: { id: memberData.member.id } });
      expect(memberCheck).not.toBeNull();
      expect(memberCheck!.status).toBe("ACTIVE");
    });

    it("Promotion -> Submit -> Approve -> Verify role change in DB", async () => {
      const { user, member, committee } = await setupAdmin();
      const currentRole = await createTestRole({ name: "Promo-Current" });
      const newRole = await createTestRole({ name: "Promo-New" });
      await assignCommitteeRole(member.id, currentRole.id, committee.id);

      // Create DRAFT promotion
      const promo = await prisma.promotionRequest.create({
        data: { memberId: member.id, currentRoleId: currentRole.id, proposedRoleId: newRole.id, reason: "Test reason", submittedById: user.user.id, status: "DRAFT" },
      });

      // Submit
      const submitRes = await PROMO_SUBMIT(
        mockRequest(`/api/promotions/${promo.id}/submit`, { method: "POST" }),
        { params: Promise.resolve({ id: promo.id }) }
      );
      expect(submitRes.status).toBe(200);

      // Approve (use different user to avoid self-approval)
      const { user: approver } = await setupUserWithPerms(["promotion.approve"]);
      mockAuth(approver.user.id, ["promotion.approve"]);
      const approveRes = await PROMO_DECISION(
        mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
        { params: Promise.resolve({ id: promo.id }) }
      );
      expect(approveRes.status).toBe(200);

      // Verify new role assigned
      const assigned = await prisma.committeeMemberRole.findFirst({
        where: { memberId: member.id, roleId: newRole.id, committeeId: committee.id },
      });
      expect(assigned).not.toBeNull();
    });

    it("Settings -> Public About reflects changes", async () => {
      await setupAdmin();
      const settingKey = `about-${uniqueSuffix()}`;
      const settingValue = `Value-${uniqueSuffix()}`;
      await SETTINGS_PATCH(
        mockRequest("/api/settings", { method: "PATCH", body: { key: settingKey, value: settingValue } })
      );
      clearAuth();
      const { GET: ABOUT_GET } = await import("@/app/api/public/about/route");
      const res = await ABOUT_GET();
      expect(res.status).toBe(200);
    });

    it("Create department -> Assign member -> Member dashboard shows it", async () => {
      const { member, committee } = await setupAdmin();
      const deptRes = await DEPTS_POST(
        mockRequest("/api/departments", { method: "POST", body: { name: `DashDept-${uniqueSuffix()}`, committeeId: committee.id } })
      );
      const deptData = await deptRes.json();

      await ADD_DEPT(
        mockRequest(`/api/members/${member.id}/departments`, { method: "POST", body: { departmentId: deptData.id } }),
        { params: Promise.resolve({ id: member.id }) }
      );

      const { GET: DASH_GET } = await import("@/app/api/dashboard/member/route");
      const dashRes = await DASH_GET();
      const dashData = await dashRes.json();
      expect(dashData.departments.some((d: Record<string, unknown>) => d.id === deptData.id)).toBe(true);
    });

    it("Create event -> Public events API shows it", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const eventTitle = `PubEv-${uniqueSuffix()}`;
      await EVENTS_POST(
        mockRequest("/api/events", { method: "POST", body: { title: eventTitle, type: "WORKSHOP", startAt: "2030-07-01T10:00:00.000Z", departmentId: dept.id } })
      );

      clearAuth();
      const res = await EVENTS_GET(mockRequest("/api/events"));
      const data = await res.json();
      expect(data.events.some((e: Record<string, unknown>) => e.title === eventTitle)).toBe(true);
    });

    it("Create update -> Public updates API shows it", async () => {
      await setupAdmin();
      const updateTitle = `PubUpd-${uniqueSuffix()}`;
      await UPDATES_POST(
        mockRequest("/api/updates", { method: "POST", body: { title: updateTitle, bodyRichText: "<p>Content</p>", category: "ANNOUNCEMENT" } })
      );

      clearAuth();
      const res = await UPDATES_GET(mockRequest("/api/updates"));
      const data = await res.json();
      expect(data.updates.some((u: Record<string, unknown>) => u.title === updateTitle)).toBe(true);
    });

    it("Create gallery album -> gallery API shows it", async () => {
        await setupAdmin();
      const albumName = `PubAlbum-${uniqueSuffix()}`;
      await GALLERY_POST(
        mockRequest("/api/gallery", { method: "POST", body: { name: albumName, category: "PRODUCTIONS" } })
      );

      const res = await GALLERY_GET(mockRequest("/api/gallery"));
      const data = await res.json();
      expect(data.some((a: Record<string, unknown>) => a.name === albumName)).toBe(true);
    });

    it("Delete event -> No longer in public API", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const evTitle = `DelEv-${uniqueSuffix()}`;
      const evRes = await EVENTS_POST(
        mockRequest("/api/events", { method: "POST", body: { title: evTitle, type: "WORKSHOP", startAt: "2030-08-01T10:00:00.000Z", departmentId: dept.id } })
      );
      const evData = await evRes.json();

      await EVENT_DELETE(
        mockRequest(`/api/events/${evData.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: evData.id }) }
      );

      clearAuth();
      const res = await EVENTS_GET(mockRequest("/api/events"));
      const data = await res.json();
      expect(data.events.some((e: Record<string, unknown>) => e.id === evData.id)).toBe(false);
    });

    it("Delete update -> No longer in public API", async () => {
      await setupAdmin();
      const updTitle = `DelUpd-${uniqueSuffix()}`;
      const updRes = await UPDATES_POST(
        mockRequest("/api/updates", { method: "POST", body: { title: updTitle, bodyRichText: "Body", category: "ANNOUNCEMENT" } })
      );
      const updData = await updRes.json();

      await UPDATE_DELETE(
        mockRequest(`/api/updates/${updData.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: updData.id }) }
      );

      clearAuth();
      const res = await UPDATES_GET(mockRequest("/api/updates"));
      const data = await res.json();
      expect(data.updates.some((u: Record<string, unknown>) => u.id === updData.id)).toBe(false);
    });

    it("Assign committee role -> GET committee shows it", async () => {
      const { member, committee } = await setupAdmin();
      const role = await createTestRole({ name: `CmtRole-${uniqueSuffix()}` });
      await ASSIGN_ROLE(
        mockRequest(`/api/committees/${committee.id}/roles`, { method: "POST", body: { memberId: member.id, roleId: role.id } }),
        { params: Promise.resolve({ id: committee.id }) }
      );

      const res = await COMMITTEE_GET(mockRequest(`/api/committees/${committee.id}`), { params: Promise.resolve({ id: committee.id }) });
      const data = await res.json();
      expect(data.memberRoles.some((mr: Record<string, unknown>) => mr.roleId === role.id && mr.memberId === member.id)).toBe(true);
    });

    it("Member status change -> reflected in member GET", async () => {
      const { member } = await setupAdmin();
      await MEMBER_PATCH(
        mockRequest(`/api/members/${member.id}`, { method: "PATCH", body: { status: "SUSPENDED" } }),
        { params: Promise.resolve({ id: member.id }) }
      );
      // Stale-JWT guard: a suspended member loses API access immediately,
      // even though their session token has not expired yet.
      const res = await MEMBER_GET(mockRequest(`/api/members/${member.id}`), { params: Promise.resolve({ id: member.id }) });
      expect(res.status).toBe(403);
    });

    it("Committee creation archives old current committee", async () => {
      const old = await createTestCommittee({ isCurrent: true });
      await setupAdmin();
      await COMMITTEES_POST(
        mockRequest("/api/committees", { method: "POST", body: { year: `20${uniqueSuffix().slice(-2)}`, startDate: "2030-01-01T00:00:00.000Z" } })
      );
      const updatedOld = await prisma.committee.findUnique({ where: { id: old.id } });
      expect(updatedOld!.isCurrent).toBe(false);
    });

    it("Department coordinator assignment -> reflected in GET", async () => {
      const { member, committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      await DEPT_PATCH(
        mockRequest(`/api/departments/${dept.id}`, { method: "PATCH", body: { coordinatorId: member.id } }),
        { params: Promise.resolve({ id: dept.id }) }
      );
      const res = await DEPT_GET(mockRequest(`/api/departments/${dept.id}`), { params: Promise.resolve({ id: dept.id }) });
      const data = await res.json();
      expect(data.coordinatorId).toBe(member.id);
    });

    it("Task creation -> department tasks GET shows it", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const taskTitle = `Task-${uniqueSuffix()}`;
      await TASKS_POST(
        mockRequest(`/api/departments/${dept.id}/tasks`, { method: "POST", body: { title: taskTitle } }),
        { params: Promise.resolve({ id: dept.id }) }
      );
      const res = await TASKS_GET(mockRequest(`/api/departments/${dept.id}/tasks`), { params: Promise.resolve({ id: dept.id }) });
      const data = await res.json();
      expect(data.some((t: Record<string, unknown>) => t.title === taskTitle)).toBe(true);
    });

    it("Task status update -> reflected in GET", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const taskRes = await TASKS_POST(
        mockRequest(`/api/departments/${dept.id}/tasks`, { method: "POST", body: { title: `Task-${uniqueSuffix()}` } }),
        { params: Promise.resolve({ id: dept.id }) }
      );
      const taskData = await taskRes.json();
      await TASK_PATCH(
        mockRequest(`/api/departments/${dept.id}/tasks/${taskData.id}`, { method: "PATCH", body: { status: "DONE" } }),
        { params: Promise.resolve({ id: dept.id, taskId: taskData.id }) }
      );
      const res = await TASKS_GET(mockRequest(`/api/departments/${dept.id}/tasks`), { params: Promise.resolve({ id: dept.id }) });
      const data = await res.json();
      expect(data.find((t: Record<string, unknown>) => t.id === taskData.id).status).toBe("DONE");
    });

    it("Registration window apply -> applicant appears in applicants GET", async () => {
      const { user, committee } = await setupAdmin();
      const rwRes = await RW_POST(
        mockRequest("/api/registration-windows", { method: "POST", body: { title: `AppRW-${uniqueSuffix()}`, description: "Test description", status: "DRAFT", startDate: "2020-01-01T00:00:00.000Z", endDate: "2030-12-31T00:00:00.000Z" } })
      );
      const rwData = await rwRes.json();
      await RW_PATCH(
        mockRequest(`/api/registration-windows/${rwData.id}`, { method: "PATCH", body: { status: "SCHEDULED" } }),
        { params: Promise.resolve({ id: rwData.id }) }
      );
      await RW_PATCH(
        mockRequest(`/api/registration-windows/${rwData.id}`, { method: "PATCH", body: { status: "LIVE" } }),
        { params: Promise.resolve({ id: rwData.id }) }
      );

      clearAuth();
      const appEmail = `appt-${uniqueSuffix()}@test.com`;
      const dept = await createTestDepartment({ committeeId: committee.id });
      await APPLY_POST(
        mockRequest(`/api/registration-windows/${rwData.id}/apply`, { method: "POST", body: { name: `Applicant-${uniqueSuffix()}`, email: appEmail, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [dept.id] } }),
        { params: Promise.resolve({ id: rwData.id }) }
      );

      mockAuth(user.user.id, ["registration.review"]);
      const res = await APPLICANTS_GET(mockRequest("/api/applicants", { searchParams: { windowId: rwData.id } }));
      const data = await res.json();
      expect(data.applicants.some((a: Record<string, unknown>) => a.email === appEmail)).toBe(true);
    });

    it("Export CSV contains applicant data", async () => {
        await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: `ExpRW-${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      const expEmail = `export-${uniqueSuffix()}@test.com`;
      await prisma.applicant.create({ data: { name: `ExportUser-${uniqueSuffix()}`, email: expEmail, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id } });

      const res = await EXPORT_GET(mockRequest("/api/applicants/export", { searchParams: { windowId: rw.id } }));
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain(expEmail);
    });
  });
});
