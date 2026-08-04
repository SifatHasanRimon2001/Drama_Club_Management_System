import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/departments/route";
import { GET as GET_ONE, PATCH } from "@/app/api/departments/[id]/route";
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

describe("Departments API", () => {
  let adminUserId: string;
  let committee: { id: string };

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-d-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    committee = await createTestCommittee({ isCurrent: true });
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

  describe("GET /api/departments", () => {
    it("returns departments for a committee", async () => {
      await createTestDepartment({ committeeId: committee.id, name: "Acting" });
      const req = mockRequest("/api/departments", { searchParams: { committeeId: committee.id } });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by current committee", async () => {
      await createTestDepartment({ committeeId: committee.id, name: "Current" });
      const oldCommittee = await createTestCommittee({ isCurrent: false, year: "Old" });
      await createTestDepartment({ committeeId: oldCommittee.id, name: "Old" });

      const res = await GET(mockRequest("/api/departments", { searchParams: { current: "true" } }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.every((d: { name: string }) => d.name !== "Old")).toBe(true);
    });

    it("returns all departments when not filtering by current", async () => {
      await createTestDepartment({ committeeId: committee.id, name: "New" });
      const oldCommittee = await createTestCommittee({ isCurrent: false, year: "Old" });
      await createTestDepartment({ committeeId: oldCommittee.id, name: "Old" });

      const res = await GET(mockRequest("/api/departments"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.length).toBeGreaterThanOrEqual(2);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await GET(mockRequest("/api/departments"));
      expect(res.status).toBe(401);
    });

    it("returns 403 when missing department.view", async () => {
      const user = await createTestUser({ email: `noperm-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, []);
      const res = await GET(mockRequest("/api/departments"));
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/departments", () => {
    it("creates a department", async () => {
      const req = mockRequest("/api/departments", {
        method: "POST",
        body: { name: `NewDept${uniqueSuffix()}`, committeeId: committee.id },
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.name).toBeTruthy();
      expect(data.committeeId).toBe(committee.id);
    });

    it("creates department with coordinator", async () => {
      const coord = await createTestUser({ email: `coord-${uniqueSuffix()}@test.com` });
      const coordMember = await createTestMember({ userId: coord.user.id });

      const res = await POST(
        mockRequest("/api/departments", {
          method: "POST",
          body: {
            name: `Coordinated${uniqueSuffix()}`,
            committeeId: committee.id,
            coordinatorId: coordMember.id,
          },
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.coordinatorId).toBe(coordMember.id);
    });

    it("rejects missing name", async () => {
      const req = mockRequest("/api/departments", {
        method: "POST",
        body: { committeeId: committee.id },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects invalid committeeId", async () => {
      const req = mockRequest("/api/departments", {
        method: "POST",
        body: { name: "Bad", committeeId: "invalid" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent committee", async () => {
      const res = await POST(
        mockRequest("/api/departments", {
          method: "POST",
          body: { name: "NoComm", committeeId: "clxxxxxxxxxxxxxxxxx" },
        })
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for nonexistent coordinator", async () => {
      const res = await POST(
        mockRequest("/api/departments", {
          method: "POST",
          body: { name: "NoCoord", committeeId: committee.id, coordinatorId: "clxxxxxxxxxxxxxxxxx" },
        })
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await POST(
        mockRequest("/api/departments", {
          method: "POST",
          body: { name: "X", committeeId: "y" },
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/departments/[id]", () => {
    it("returns a single department with full details", async () => {
      const dept = await createTestDepartment({ committeeId: committee.id, name: "DetailDept" });

      const res = await GET_ONE(
        mockRequest(`/api/departments/${dept.id}`),
        { params: Promise.resolve({ id: dept.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe(dept.id);
      expect(data.name).toBe("DetailDept");
      expect(data).toHaveProperty("committee");
      expect(data).toHaveProperty("members");
      expect(data).toHaveProperty("tasks");
      expect(data).toHaveProperty("events");
    });

    it("returns 404 for nonexistent department", async () => {
      const res = await GET_ONE(
        mockRequest("/api/departments/fake"),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const res = await GET_ONE(
        mockRequest(`/api/departments/${dept.id}`),
        { params: Promise.resolve({ id: dept.id }) }
      );
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/departments/[id]", () => {
    it("updates a department", async () => {
      const dept = await createTestDepartment({ committeeId: committee.id, name: "OldName" });
      const req = mockRequest(`/api/departments/${dept.id}`, {
        method: "PATCH",
        body: { name: "NewName" },
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: dept.id }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.name).toBe("NewName");
    });

    it("updates coordinator", async () => {
      const dept = await createTestDepartment({ committeeId: committee.id });
      const coord = await createTestUser({ email: `newcoord-${uniqueSuffix()}@test.com` });
      const coordMember = await createTestMember({ userId: coord.user.id });

      const res = await PATCH(
        mockRequest(`/api/departments/${dept.id}`, {
          method: "PATCH",
          body: { coordinatorId: coordMember.id },
        }),
        { params: Promise.resolve({ id: dept.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.coordinatorId).toBe(coordMember.id);
    });

    it("returns 404 for nonexistent department", async () => {
      const res = await PATCH(
        mockRequest("/api/departments/x", { method: "PATCH", body: { name: "X" } }),
        { params: Promise.resolve({ id: "nonexistent" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const res = await PATCH(
        mockRequest(`/api/departments/${dept.id}`, { method: "PATCH", body: { name: "X" } }),
        { params: Promise.resolve({ id: dept.id }) }
      );
      expect(res.status).toBe(401);
    });
  });
});
