import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/committees/route";
import { PATCH } from "@/app/api/committees/[id]/route";
import { GET as GET_ONE } from "@/app/api/committees/[id]/route";
import { POST as ASSIGN_ROLE, DELETE as REMOVE_ROLE } from "@/app/api/committees/[id]/roles/route";
import {
  mockRequest,
  mockAuth,
  clearAuth,
  cleanupTestData,
  seedPermissions,
  createTestUser,
  createTestMember,
  createTestCommittee,
  createTestRole,
  assignCommitteeRole,
  uniqueSuffix,
} from "./helpers";
import prisma from "@/lib/prisma";

describe("Committees API", () => {
  let adminUserId: string;
  let committee: { id: string };

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-c-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ["committee.manage"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);

    mockAuth(adminUserId, ["committee.manage"]);
  });

  describe("GET /api/committees", () => {
    it("returns committees list", async () => {
      await createTestCommittee({ year: "2025" });
      const req = mockRequest("/api/committees");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it("returns current committee for unauthenticated users", async () => {
      clearAuth();
      const res = await GET(mockRequest("/api/committees"));
      expect(res.status).toBe(200);
    });

    it("returns 401 when unauthenticated requests all committees", async () => {
      clearAuth();
      const res = await GET(mockRequest("/api/committees", { searchParams: { all: "true" } }));
      expect(res.status).toBe(401);
    });

    it("returns all committees when authenticated with all=true", async () => {
      await createTestCommittee({ year: "2023", isCurrent: false });
      await createTestCommittee({ year: "2024", isCurrent: false });

      const res = await GET(mockRequest("/api/committees", { searchParams: { all: "true" } }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.length).toBeGreaterThanOrEqual(3);
    });

    it("includes departments in committee response", async () => {
      const res = await GET(mockRequest("/api/committees"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data[0]).toHaveProperty("departments");
    });

    it("includes memberRoles in committee response", async () => {
      const res = await GET(mockRequest("/api/committees"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data[0]).toHaveProperty("memberRoles");
    });
  });

  describe("POST /api/committees", () => {
    it("creates a committee", async () => {
      const req = mockRequest("/api/committees", {
        method: "POST",
        body: {
          year: `Year${uniqueSuffix()}`,
          startDate: "2024-01-01T00:00:00.000Z",
          isCurrent: true,
        },
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.year).toBeTruthy();
      expect(data.isCurrent).toBe(true);
    });

    it("rejects missing year", async () => {
      const req = mockRequest("/api/committees", {
        method: "POST",
        body: { startDate: "2024-01-01T00:00:00.000Z" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects missing startDate", async () => {
      const req = mockRequest("/api/committees", {
        method: "POST",
        body: { year: "2025" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("archives previous current committee when creating new current", async () => {
      await createTestCommittee({ isCurrent: true, year: "Old" });

      const res = await POST(
        mockRequest("/api/committees", {
          method: "POST",
          body: {
            year: `New${uniqueSuffix()}`,
            startDate: "2024-01-01T00:00:00.000Z",
            isCurrent: true,
          },
        })
      );
      expect(res.status).toBe(201);

      const oldCommittee = await prisma.committee.findFirst({ where: { year: "Old" } });
      expect(oldCommittee!.isCurrent).toBe(false);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await POST(
        mockRequest("/api/committees", {
          method: "POST",
          body: { year: "X", startDate: "2024-01-01T00:00:00.000Z" },
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/committees/[id]", () => {
    it("returns a single committee", async () => {
      const res = await GET_ONE(
        mockRequest(`/api/committees/${committee.id}`),
        { params: Promise.resolve({ id: committee.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe(committee.id);
    });

    it("returns 404 for nonexistent committee", async () => {
      const res = await GET_ONE(
        mockRequest("/api/committees/fake"),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("is accessible without authentication", async () => {
      clearAuth();
      const res = await GET_ONE(
        mockRequest(`/api/committees/${committee.id}`),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(200);
    });

    it("does not expose member emails to unauthenticated users", async () => {
      clearAuth();
      const res = await GET_ONE(
        mockRequest(`/api/committees/${committee.id}`),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.memberRoles.length).toBeGreaterThan(0);
      expect(data.memberRoles[0].member.user.email).toBeUndefined();
    });

    it("exposes member emails to authenticated users", async () => {
      const res = await GET_ONE(
        mockRequest(`/api/committees/${committee.id}`),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.memberRoles[0].member.user.email).toBeDefined();
    });
  });

  describe("PATCH /api/committees/[id]", () => {
    it("updates committee fields", async () => {
      const c = await createTestCommittee({ year: "2023" });
      const req = mockRequest(`/api/committees/${c.id}`, {
        method: "PATCH",
        body: { isCurrent: false },
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: c.id }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isCurrent).toBe(false);
    });

    it("updates year", async () => {
      const res = await PATCH(
        mockRequest(`/api/committees/${committee.id}`, {
          method: "PATCH",
          body: { year: "Updated2025" },
        }),
        { params: Promise.resolve({ id: committee.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.year).toBe("Updated2025");
    });

    it("returns 404 for nonexistent committee", async () => {
      const res = await PATCH(
        mockRequest("/api/committees/x", { method: "PATCH", body: { year: "X" } }),
        { params: Promise.resolve({ id: "nonexistent" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await PATCH(
        mockRequest(`/api/committees/${committee.id}`, {
          method: "PATCH",
          body: { year: "X" },
        }),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/committees/[id]/roles", () => {
    it("assigns a role to a member", async () => {
      const u = await createTestUser({ email: `roleuser-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const role = await createTestRole({ name: `TestRole-${uniqueSuffix()}` });

      const res = await ASSIGN_ROLE(
        mockRequest(`/api/committees/${committee.id}/roles`, {
          method: "POST",
          body: { memberId: m.id, roleId: role.id },
        }),
        { params: Promise.resolve({ id: committee.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.member.id).toBe(m.id);
      expect(data.role.id).toBe(role.id);
    });

    it("rejects duplicate role assignment", async () => {
      const u = await createTestUser({ email: `duprole-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const role = await createTestRole({ name: `DupRole-${uniqueSuffix()}` });
      await assignCommitteeRole(m.id, role.id, committee.id);

      const res = await ASSIGN_ROLE(
        mockRequest(`/api/committees/${committee.id}/roles`, {
          method: "POST",
          body: { memberId: m.id, roleId: role.id },
        }),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(409);
    });

    it("returns 404 for nonexistent committee", async () => {
      const u = await createTestUser({ email: `nocomm-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const role = await createTestRole({ name: `NoComm-${uniqueSuffix()}` });
      const res = await ASSIGN_ROLE(
        mockRequest("/api/committees/fake/roles", {
          method: "POST",
          body: { memberId: m.id, roleId: role.id },
        }),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for nonexistent member", async () => {
      const role = await createTestRole({ name: `NoMember-${uniqueSuffix()}` });
      const res = await ASSIGN_ROLE(
        mockRequest(`/api/committees/${committee.id}/roles`, {
          method: "POST",
          body: { memberId: "cl00000000000000000000000", roleId: role.id },
        }),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for nonexistent role", async () => {
      const u = await createTestUser({ email: `norole-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const res = await ASSIGN_ROLE(
        mockRequest(`/api/committees/${committee.id}/roles`, {
          method: "POST",
          body: { memberId: m.id, roleId: "cl00000000000000000000000" },
        }),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await ASSIGN_ROLE(
        mockRequest(`/api/committees/${committee.id}/roles`, {
          method: "POST",
          body: { memberId: "x", roleId: "y" },
        }),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/committees/[id]/roles", () => {
    it("soft-deletes a role assignment", async () => {
      const u = await createTestUser({ email: `softdel-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const role = await createTestRole({ name: `SoftDel-${uniqueSuffix()}` });
      const cmr = await assignCommitteeRole(m.id, role.id, committee.id);

      const res = await REMOVE_ROLE(
        mockRequest(`/api/committees/${committee.id}/roles?memberRoleId=${cmr.id}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: committee.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe("Role removed from committee");

      const updated = await prisma.committeeMemberRole.findUnique({ where: { id: cmr.id } });
      expect(updated!.endedAt).not.toBeNull();
    });

    it("returns 400 when memberRoleId is missing", async () => {
      const res = await REMOVE_ROLE(
        mockRequest(`/api/committees/${committee.id}/roles`, { method: "DELETE" }),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent role assignment", async () => {
      const res = await REMOVE_ROLE(
        mockRequest(`/api/committees/${committee.id}/roles?memberRoleId=fake`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when role belongs to different committee", async () => {
      const otherCommittee = await createTestCommittee({ isCurrent: false, year: "Other" });
      const u = await createTestUser({ email: `wrongcomm-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const role = await createTestRole({ name: `WrongComm-${uniqueSuffix()}` });
      const cmr = await assignCommitteeRole(m.id, role.id, otherCommittee.id);

      const res = await REMOVE_ROLE(
        mockRequest(`/api/committees/${committee.id}/roles?memberRoleId=${cmr.id}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(403);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await REMOVE_ROLE(
        mockRequest(`/api/committees/${committee.id}/roles?memberRoleId=x`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(401);
    });
  });
});
