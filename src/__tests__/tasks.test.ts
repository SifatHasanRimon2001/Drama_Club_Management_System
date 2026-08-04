import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/departments/[id]/tasks/route";
import { PATCH, DELETE } from "@/app/api/departments/[id]/tasks/[taskId]/route";
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
  uniqueSuffix,
} from "./helpers";
import prisma from "@/lib/prisma";

describe("Tasks API", () => {
  let adminUserId: string;
  let department: { id: string };

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-t-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    department = await createTestDepartment({ committeeId: committee.id });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ["department.view", "department.manage"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);

    mockAuth(adminUserId, ["department.view", "department.manage"]);
  });

  describe("GET /api/departments/[id]/tasks", () => {
    it("returns tasks for a department", async () => {
      await prisma.task.create({
        data: { title: "Test Task", departmentId: department.id },
      });

      const req = mockRequest(`/api/departments/${department.id}/tasks`);
      const res = await GET(req, { params: Promise.resolve({ id: department.id }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by status", async () => {
      await prisma.task.create({ data: { title: "TODO Task", departmentId: department.id, status: "TODO" } });
      await prisma.task.create({ data: { title: "DONE Task", departmentId: department.id, status: "DONE" } });

      const res = await GET(
        mockRequest(`/api/departments/${department.id}/tasks`, { searchParams: { status: "TODO" } }),
        { params: Promise.resolve({ id: department.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.every((t: { status: string }) => t.status === "TODO")).toBe(true);
    });

    it("filters by assigneeId", async () => {
      const u = await createTestUser({ email: `assignee-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });

      await prisma.task.create({ data: { title: "Assigned", departmentId: department.id, assigneeId: m.id } });
      await prisma.task.create({ data: { title: "Unassigned", departmentId: department.id } });

      const res = await GET(
        mockRequest(`/api/departments/${department.id}/tasks`, { searchParams: { assigneeId: m.id } }),
        { params: Promise.resolve({ id: department.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.length).toBe(1);
      expect(data[0].title).toBe("Assigned");
    });

    it("returns 404 for nonexistent department", async () => {
      const res = await GET(
        mockRequest("/api/departments/fake/tasks"),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await GET(
        mockRequest(`/api/departments/${department.id}/tasks`),
        { params: Promise.resolve({ id: department.id }) }
      );
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/departments/[id]/tasks", () => {
    it("creates a task", async () => {
      const req = mockRequest(`/api/departments/${department.id}/tasks`, {
        method: "POST",
        body: { title: `Task${uniqueSuffix()}` },
      });
      const res = await POST(req, { params: Promise.resolve({ id: department.id }) });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.title).toBeTruthy();
      expect(data.departmentId).toBe(department.id);
      expect(data.status).toBe("TODO");
    });

    it("creates a task with assignee", async () => {
      const u = await createTestUser({ email: `taskassign-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });

      const res = await POST(
        mockRequest(`/api/departments/${department.id}/tasks`, {
          method: "POST",
          body: { title: "Assigned Task", assigneeId: m.id },
        }),
        { params: Promise.resolve({ id: department.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.assigneeId).toBe(m.id);
    });

    it("creates a task with specific status", async () => {
      const res = await POST(
        mockRequest(`/api/departments/${department.id}/tasks`, {
          method: "POST",
          body: { title: "In Progress", status: "IN_PROGRESS" },
        }),
        { params: Promise.resolve({ id: department.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.status).toBe("IN_PROGRESS");
    });

    it("rejects empty title", async () => {
      const req = mockRequest(`/api/departments/${department.id}/tasks`, {
        method: "POST",
        body: { title: "" },
      });
      const res = await POST(req, { params: Promise.resolve({ id: department.id }) });
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent department", async () => {
      const req = mockRequest("/api/departments/fake/tasks", {
        method: "POST",
        body: { title: "X" },
      });
      const res = await POST(req, { params: Promise.resolve({ id: "fake" }) });
      expect(res.status).toBe(404);
    });

    it("returns 404 for nonexistent assignee", async () => {
      const res = await POST(
        mockRequest(`/api/departments/${department.id}/tasks`, {
          method: "POST",
          body: { title: "Bad Assignee", assigneeId: "clxxxxxxxxxxxxxxxxx" },
        }),
        { params: Promise.resolve({ id: department.id }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/departments/[id]/tasks/[taskId]", () => {
    it("updates a task", async () => {
      const task = await prisma.task.create({
        data: { title: "Old Task", departmentId: department.id },
      });

      const req = mockRequest(`/api/departments/${department.id}/tasks/${task.id}`, {
        method: "PATCH",
        body: { title: "New Task", status: "IN_PROGRESS" },
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ id: department.id, taskId: task.id }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.title).toBe("New Task");
      expect(data.status).toBe("IN_PROGRESS");
    });

    it("transitions task to DONE", async () => {
      const task = await prisma.task.create({
        data: { title: "Done Task", departmentId: department.id, status: "IN_PROGRESS" },
      });

      const res = await PATCH(
        mockRequest(`/api/departments/${department.id}/tasks/${task.id}`, {
          method: "PATCH",
          body: { status: "DONE" },
        }),
        { params: Promise.resolve({ id: department.id, taskId: task.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("DONE");
    });

    it("prevents IDOR - task from different department", async () => {
      const otherDept = await createTestDepartment();
      const task = await prisma.task.create({
        data: { title: "Other Task", departmentId: otherDept.id },
      });

      const req = mockRequest(`/api/departments/${department.id}/tasks/${task.id}`, {
        method: "PATCH",
        body: { title: "Hacked" },
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ id: department.id, taskId: task.id }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 for nonexistent task", async () => {
      const res = await PATCH(
        mockRequest(`/api/departments/${department.id}/tasks/fake`, {
          method: "PATCH",
          body: { title: "X" },
        }),
        { params: Promise.resolve({ id: department.id, taskId: "fake" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/departments/[id]/tasks/[taskId]", () => {
    it("deletes a task", async () => {
      const task = await prisma.task.create({
        data: { title: "Del Task", departmentId: department.id },
      });

      const res = await DELETE(
        mockRequest(`/api/departments/${department.id}/tasks/${task.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: department.id, taskId: task.id }) }
      );
      expect(res.status).toBe(200);

      const deleted = await prisma.task.findUnique({ where: { id: task.id } });
      expect(deleted).toBeNull();
    });

    it("prevents IDOR - delete task from different department", async () => {
      const otherDept = await createTestDepartment();
      const task = await prisma.task.create({
        data: { title: "Other Task", departmentId: otherDept.id },
      });

      const res = await DELETE(
        mockRequest(`/api/departments/${department.id}/tasks/${task.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: department.id, taskId: task.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for nonexistent task", async () => {
      const res = await DELETE(
        mockRequest(`/api/departments/${department.id}/tasks/fake`, { method: "DELETE" }),
        { params: Promise.resolve({ id: department.id, taskId: "fake" }) }
      );
      expect(res.status).toBe(404);
    });
  });
});
