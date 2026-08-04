import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/members/route";
import { GET as GET_ONE, PATCH } from "@/app/api/members/[id]/route";
import { POST as ADD_DEPT, DELETE as REMOVE_DEPT } from "@/app/api/members/[id]/departments/route";
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
} from "./helpers";
import prisma from "@/lib/prisma";

describe("Members API", () => {
  let adminUserId: string;
  let committee: { id: string };

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-m-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ["member.view", "member.create", "member.edit", "department.manage"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);

    mockAuth(adminUserId, ["member.view", "member.create", "member.edit", "department.manage"]);
  });

  describe("GET /api/members", () => {
    it("returns paginated members", async () => {
      const u1 = await createTestUser({ email: `list1-${uniqueSuffix()}@test.com` });
      await createTestMember({ userId: u1.user.id, status: "ACTIVE" });

      const req = mockRequest("/api/members");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.members).toBeDefined();
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it("filters by status", async () => {
      const u = await createTestUser({ email: `filt-${uniqueSuffix()}@test.com` });
      await createTestMember({ userId: u.user.id, status: "INACTIVE" });

      const req = mockRequest("/api/members", { searchParams: { status: "INACTIVE" } });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.members.length).toBeGreaterThanOrEqual(1);
      expect(data.members.every((m: { status: string }) => m.status === "INACTIVE")).toBe(true);
    });

    it("searches by name", async () => {
      const unique = uniqueSuffix();
      const u = await createTestUser({ name: `Searchable${unique}`, email: `search-${unique}@test.com` });
      await createTestMember({ userId: u.user.id });

      const req = mockRequest("/api/members", { searchParams: { search: `Searchable${unique}` } });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.members.length).toBe(1);
    });

    it("searches by email", async () => {
      const unique = uniqueSuffix();
      const u = await createTestUser({ email: `findme-${unique}@test.com` });
      await createTestMember({ userId: u.user.id });

      const req = mockRequest("/api/members", { searchParams: { search: `findme-${unique}` } });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.members.length).toBe(1);
    });

    it("searches by memberCode", async () => {
      const code = `SEARCH${uniqueSuffix()}`;
      await createTestMember({ memberCode: code });

      const req = mockRequest("/api/members", { searchParams: { search: code } });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.members.length).toBe(1);
    });

    it("paginates with page and limit", async () => {
      for (let i = 0; i < 5; i++) {
        const u = await createTestUser({ email: `page-${i}-${uniqueSuffix()}@test.com` });
        await createTestMember({ userId: u.user.id });
      }

      const req = mockRequest("/api/members", { searchParams: { page: "1", limit: "2" } });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.members.length).toBe(2);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.total).toBeGreaterThanOrEqual(5);
      expect(data.pagination.totalPages).toBeGreaterThanOrEqual(3);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const req = mockRequest("/api/members");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 when missing member.view permission", async () => {
      const user = await createTestUser({ email: `noperm-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, []);
      const req = mockRequest("/api/members");
      const res = await GET(req);
      expect(res.status).toBe(403);
    });

    it("returns members with correct shape", async () => {
      const u = await createTestUser({ email: `shape-${uniqueSuffix()}@test.com` });
      await createTestMember({ userId: u.user.id, memberCode: `MC${uniqueSuffix()}` });

      const res = await GET(mockRequest("/api/members"));
      const data = await res.json();

      expect(res.status).toBe(200);
      const member = data.members[0];
      expect(member).toHaveProperty("id");
      expect(member).toHaveProperty("memberCode");
      expect(member).toHaveProperty("status");
      expect(member).toHaveProperty("user");
      expect(member.user).toHaveProperty("name");
      expect(member.user).toHaveProperty("email");
    });
  });

  describe("POST /api/members", () => {
    it("creates a new member", async () => {
      const newUser = await createTestUser({ email: `newm-${uniqueSuffix()}@test.com` });
      const req = mockRequest("/api/members", {
        method: "POST",
        body: { userId: newUser.user.id, memberCode: `MC${uniqueSuffix()}` },
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.userId).toBe(newUser.user.id);
      expect(data.status).toBe("PENDING");
    });

    it("rejects duplicate userId", async () => {
      const member = await createTestMember();
      const req = mockRequest("/api/members", {
        method: "POST",
        body: { userId: member.userId, memberCode: `MC${uniqueSuffix()}` },
      });
      const res = await POST(req);
      expect(res.status).toBe(409);
    });

    it("rejects duplicate memberCode", async () => {
      await createTestMember({ memberCode: "DUP123" });
      const newUser = await createTestUser({ email: `code-${uniqueSuffix()}@test.com` });
      const req = mockRequest("/api/members", {
        method: "POST",
        body: { userId: newUser.user.id, memberCode: "DUP123" },
      });
      const res = await POST(req);
      expect(res.status).toBe(409);
    });

    it("rejects invalid userId format", async () => {
      const req = mockRequest("/api/members", {
        method: "POST",
        body: { userId: "not-a-cuid", memberCode: "MC1" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects missing memberCode", async () => {
      const newUser = await createTestUser({ email: `nocode-${uniqueSuffix()}@test.com` });
      const req = mockRequest("/api/members", {
        method: "POST",
        body: { userId: newUser.user.id },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const req = mockRequest("/api/members", {
        method: "POST",
        body: { userId: "x", memberCode: "Y" },
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 when missing member.create permission", async () => {
      const user = await createTestUser({ email: `noperm-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, []);
      const req = mockRequest("/api/members", {
        method: "POST",
        body: { userId: "x", memberCode: "Y" },
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("creates member with default PENDING status", async () => {
      const newUser = await createTestUser({ email: `pend-${uniqueSuffix()}@test.com` });
      const res = await POST(
        mockRequest("/api/members", {
          method: "POST",
          body: { userId: newUser.user.id, memberCode: `MC${uniqueSuffix()}` },
        })
      );
      const data = await res.json();
      expect(data.status).toBe("PENDING");
    });
  });

  describe("GET /api/members/[id]", () => {
    it("returns a single member", async () => {
      const u = await createTestUser({ email: `single-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });

      const res = await GET_ONE(
        mockRequest(`/api/members/${m.id}`),
        { params: Promise.resolve({ id: m.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe(m.id);
      expect(data.user.name).toBe(u.user.name);
    });

    it("includes departments in response", async () => {
      const u = await createTestUser({ email: `withdept-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const dept = await createTestDepartment({ committeeId: committee.id });
      await assignDepartment(m.id, dept.id);

      const res = await GET_ONE(
        mockRequest(`/api/members/${m.id}`),
        { params: Promise.resolve({ id: m.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.departments).toBeDefined();
      expect(data.departments.length).toBe(1);
    });

    it("includes committeeRoles in response", async () => {
      const u = await createTestUser({ email: `withrole-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const role = await createTestRole({ name: `Role-${uniqueSuffix()}` });
      await assignCommitteeRole(m.id, role.id, committee.id);

      const res = await GET_ONE(
        mockRequest(`/api/members/${m.id}`),
        { params: Promise.resolve({ id: m.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.committeeRoles).toBeDefined();
      expect(data.committeeRoles.length).toBe(1);
    });

    it("returns 404 for nonexistent member", async () => {
      const res = await GET_ONE(
        mockRequest("/api/members/fake"),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const u = await createTestUser({ email: `unauth-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const res = await GET_ONE(
        mockRequest(`/api/members/${m.id}`),
        { params: Promise.resolve({ id: m.id }) }
      );
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/members/[id]", () => {
    it("updates member phone", async () => {
      const u = await createTestUser({ email: `patch-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });

      const res = await PATCH(
        mockRequest(`/api/members/${m.id}`, {
          method: "PATCH",
          body: { phone: "555-1234" },
        }),
        { params: Promise.resolve({ id: m.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.phone).toBe("555-1234");
    });

    it("updates member status", async () => {
      const u = await createTestUser({ email: `status-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id, status: "ACTIVE" });

      const res = await PATCH(
        mockRequest(`/api/members/${m.id}`, {
          method: "PATCH",
          body: { status: "ALUMNI" },
        }),
        { params: Promise.resolve({ id: m.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("ALUMNI");
    });

    it("updates member address", async () => {
      const u = await createTestUser({ email: `addr-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });

      const res = await PATCH(
        mockRequest(`/api/members/${m.id}`, {
          method: "PATCH",
          body: { address: "123 Main St" },
        }),
        { params: Promise.resolve({ id: m.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.address).toBe("123 Main St");
    });

    it("returns 404 for nonexistent member", async () => {
      const res = await PATCH(
        mockRequest("/api/members/fake", { method: "PATCH", body: { phone: "123" } }),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const u = await createTestUser({ email: `unauth-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const res = await PATCH(
        mockRequest(`/api/members/${m.id}`, { method: "PATCH", body: { phone: "123" } }),
        { params: Promise.resolve({ id: m.id }) }
      );
      expect(res.status).toBe(401);
    });

    it("returns 403 when missing member.edit permission", async () => {
      const user = await createTestUser({ email: `noperm-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, []);
      const u2 = await createTestUser({ email: `target-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u2.user.id });
      const res = await PATCH(
        mockRequest(`/api/members/${m.id}`, { method: "PATCH", body: { phone: "123" } }),
        { params: Promise.resolve({ id: m.id }) }
      );
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/members/[id]/departments", () => {
    it("assigns a member to a department", async () => {
      const u = await createTestUser({ email: `assign-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const dept = await createTestDepartment({ committeeId: committee.id });

      const res = await ADD_DEPT(
        mockRequest(`/api/members/${m.id}/departments`, {
          method: "POST",
          body: { departmentId: dept.id },
        }),
        { params: Promise.resolve({ id: m.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.department.id).toBe(dept.id);
      expect(data.member.id).toBe(m.id);
    });

    it("rejects duplicate department assignment", async () => {
      const u = await createTestUser({ email: `dupassign-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const dept = await createTestDepartment({ committeeId: committee.id });
      await assignDepartment(m.id, dept.id);

      const res = await ADD_DEPT(
        mockRequest(`/api/members/${m.id}/departments`, {
          method: "POST",
          body: { departmentId: dept.id },
        }),
        { params: Promise.resolve({ id: m.id }) }
      );
      expect(res.status).toBe(409);
    });

    it("returns 404 for nonexistent member", async () => {
      const dept = await createTestDepartment({ committeeId: committee.id });
      const res = await ADD_DEPT(
        mockRequest("/api/members/fake/departments", {
          method: "POST",
          body: { departmentId: dept.id },
        }),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for nonexistent department", async () => {
      const u = await createTestUser({ email: `nodept-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const res = await ADD_DEPT(
        mockRequest(`/api/members/${m.id}/departments`, {
          method: "POST",
          body: { departmentId: "cl00000000000000000000000" },
        }),
        { params: Promise.resolve({ id: m.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const u = await createTestUser({ email: `unauth-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const res = await ADD_DEPT(
        mockRequest(`/api/members/${m.id}/departments`, {
          method: "POST",
          body: { departmentId: "x" },
        }),
        { params: Promise.resolve({ id: m.id }) }
      );
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/members/[id]/departments", () => {
    it("removes a member from a department", async () => {
      const u = await createTestUser({ email: `remove-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const dept = await createTestDepartment({ committeeId: committee.id });
      await assignDepartment(m.id, dept.id);

      const res = await REMOVE_DEPT(
        mockRequest(`/api/members/${m.id}/departments?departmentId=${dept.id}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: m.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe("Removed from department");

      const assignment = await prisma.memberDepartment.findUnique({
        where: { memberId_departmentId: { memberId: m.id, departmentId: dept.id } },
      });
      expect(assignment).toBeNull();
    });

    it("returns 400 when departmentId is missing", async () => {
      const u = await createTestUser({ email: `missing-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const res = await REMOVE_DEPT(
        mockRequest(`/api/members/${m.id}/departments`, { method: "DELETE" }),
        { params: Promise.resolve({ id: m.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 when member is not in the department", async () => {
      const u = await createTestUser({ email: `notin-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const dept = await createTestDepartment({ committeeId: committee.id });

      const res = await REMOVE_DEPT(
        mockRequest(`/api/members/${m.id}/departments?departmentId=${dept.id}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: m.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const u = await createTestUser({ email: `unauth-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const res = await REMOVE_DEPT(
        mockRequest(`/api/members/${m.id}/departments?departmentId=x`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: m.id }) }
      );
      expect(res.status).toBe(401);
    });
  });
});
