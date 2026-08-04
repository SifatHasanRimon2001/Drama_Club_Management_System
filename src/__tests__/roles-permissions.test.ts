import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/roles/route";
import { GET as GET_ONE, PATCH, DELETE } from "@/app/api/roles/[id]/route";
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

describe("Roles & Permissions API", () => {
  let adminUserId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-r-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({
      name: "SuperAdmin",
      permissionIds: (
        await Promise.all(
          ["permissions.manage"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);

    mockAuth(adminUserId, ["permissions.manage"]);
  });

  describe("GET /api/roles", () => {
    it("returns all roles with permissions", async () => {
      await createTestRole({ name: `RoleA${uniqueSuffix()}` });
      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns 403 without permissions.manage", async () => {
      const user = await createTestUser({ email: `noperm-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, []);
      const res = await GET();
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/roles", () => {
    it("creates a role", async () => {
      const perms = await seedPermissions();
      const permIds = perms.slice(0, 3).map((p) => p.id);

      const res = await POST(
        mockRequest("/api/roles", {
          method: "POST",
          body: { name: `NewRole${uniqueSuffix()}`, permissionIds: permIds },
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.name).toBeTruthy();
      expect(data.permissions.length).toBe(3);
    });

    it("creates a role without permissions", async () => {
      const res = await POST(
        mockRequest("/api/roles", {
          method: "POST",
          body: { name: `EmptyRole${uniqueSuffix()}` },
        })
      );
      expect(res.status).toBe(201);
    });

    it("rejects duplicate role name", async () => {
      const uniqueName = `DupRole${uniqueSuffix()}`;
      await prisma.role.create({ data: { name: uniqueName } });
      const res = await POST(
        mockRequest("/api/roles", { method: "POST", body: { name: uniqueName } })
      );
      expect(res.status).toBe(409);
    });

    it("rejects empty name", async () => {
      const res = await POST(
        mockRequest("/api/roles", { method: "POST", body: { name: "" } })
      );
      expect(res.status).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await POST(
        mockRequest("/api/roles", { method: "POST", body: { name: "X" } })
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/roles/[id]", () => {
    it("returns a single role with permissions", async () => {
      const perms = await seedPermissions();
      const role = await createTestRole({ name: `DetailRole-${uniqueSuffix()}`, permissionIds: perms.slice(0, 2).map((p) => p.id) });

      const res = await GET_ONE(
        mockRequest(`/api/roles/${role.id}`),
        { params: Promise.resolve({ id: role.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe(role.id);
      expect(data.permissions).toBeDefined();
    });

    it("returns 404 for nonexistent role", async () => {
      const res = await GET_ONE(
        mockRequest("/api/roles/fake"),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/roles/[id]", () => {
    it("updates a role name", async () => {
      const role = await createTestRole({ name: "OldName" });
      const res = await PATCH(
        mockRequest(`/api/roles/${role.id}`, { method: "PATCH", body: { name: "NewName" } }),
        { params: Promise.resolve({ id: role.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.name).toBe("NewName");
    });

    it("replaces permissions", async () => {
      const perms = await seedPermissions();
      const role = await createTestRole({ name: `PermRole-${uniqueSuffix()}`, permissionIds: perms.slice(0, 2).map((p) => p.id) });

      const res = await PATCH(
        mockRequest(`/api/roles/${role.id}`, {
          method: "PATCH",
          body: { permissionIds: perms.slice(2, 5).map((p) => p.id) },
        }),
        { params: Promise.resolve({ id: role.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.permissions.length).toBe(3);
    });

    it("clears permissions with empty array", async () => {
      const perms = await seedPermissions();
      const role = await createTestRole({ name: `ClearRole-${uniqueSuffix()}`, permissionIds: perms.slice(0, 2).map((p) => p.id) });

      const res = await PATCH(
        mockRequest(`/api/roles/${role.id}`, {
          method: "PATCH",
          body: { permissionIds: [] },
        }),
        { params: Promise.resolve({ id: role.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.permissions.length).toBe(0);
    });

    it("returns 404 for nonexistent role", async () => {
      const res = await PATCH(
        mockRequest("/api/roles/nonexistent", { method: "PATCH", body: { name: "X" } }),
        { params: Promise.resolve({ id: "nonexistent" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/roles/[id]", () => {
    it("deletes a role with no active assignments", async () => {
      const role = await createTestRole({ name: "ToDelete" });
      const res = await DELETE(
        mockRequest(`/api/roles/${role.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: role.id }) }
      );
      expect(res.status).toBe(200);

      const deleted = await prisma.role.findUnique({ where: { id: role.id } });
      expect(deleted).toBeNull();
    });

    it("returns 400 when role has active assignments", async () => {
      const committee = await createTestCommittee({ isCurrent: true });
      const u = await createTestUser({ email: `roleuser-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id });
      const role = await createTestRole({ name: `ActiveRole-${uniqueSuffix()}` });
      await assignCommitteeRole(m.id, role.id, committee.id);

      const res = await DELETE(
        mockRequest(`/api/roles/${role.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: role.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent role", async () => {
      const res = await DELETE(
        mockRequest("/api/roles/x", { method: "DELETE" }),
        { params: Promise.resolve({ id: "nonexistent" }) }
      );
      expect(res.status).toBe(404);
    });
  });
});
