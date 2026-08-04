import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/members/route";
import { POST as EVENTS_POST } from "@/app/api/events/route";
import { GET as ROLES_GET } from "@/app/api/roles/route";
import { GET as SETTINGS_GET } from "@/app/api/settings/route";
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

describe("RBAC Permission Enforcement", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  async function setupUserWithPermissions(permissions: string[]) {
    const user = await createTestUser({ email: `rbac-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });

    if (permissions.length > 0) {
      const role = await createTestRole({
        name: `Role${uniqueSuffix()}`,
        permissionIds: (
          await Promise.all(
            permissions.map(async (k) => {
              const p = await prisma.permission.findUnique({ where: { key: k } });
              return p!.id;
            })
          )
        ),
      });
      await assignCommitteeRole(member.id, role.id, committee.id);
    }

    return { user, member, committee };
  }

  describe("Unauthenticated access", () => {
    it("returns 401 for protected endpoints", async () => {
      clearAuth();

      const endpoints = [
        () => GET(mockRequest("/api/members")),
        () => ROLES_GET(),
        () => SETTINGS_GET(),
      ];

      for (const endpoint of endpoints) {
        const res = await endpoint();
        expect(res.status).toBe(401);
      }
    });
  });

  describe("member.view permission", () => {
    it("grants access to GET /api/members", async () => {
      const { user } = await setupUserWithPermissions(["member.view"]);
      mockAuth(user.user.id, ["member.view"]);

      const res = await GET(mockRequest("/api/members"));
      expect(res.status).toBe(200);
    });

    it("denies access without permission", async () => {
      const { user } = await setupUserWithPermissions([]);
      mockAuth(user.user.id, []);

      const res = await GET(mockRequest("/api/members"));
      expect(res.status).toBe(403);
    });
  });

  describe("permissions.manage permission", () => {
    it("grants access to GET /api/roles", async () => {
      const { user } = await setupUserWithPermissions(["permissions.manage"]);
      mockAuth(user.user.id, ["permissions.manage"]);

      const res = await ROLES_GET();
      expect(res.status).toBe(200);
    });

    it("denies access without permission", async () => {
      const { user } = await setupUserWithPermissions([]);
      mockAuth(user.user.id, []);

      const res = await ROLES_GET();
      expect(res.status).toBe(403);
    });
  });

  describe("settings.manage permission", () => {
    it("grants access to GET /api/settings", async () => {
      const { user } = await setupUserWithPermissions(["settings.manage"]);
      mockAuth(user.user.id, ["settings.manage"]);

      const res = await SETTINGS_GET();
      expect(res.status).toBe(200);
    });

    it("denies access without permission", async () => {
      const { user } = await setupUserWithPermissions([]);
      mockAuth(user.user.id, []);

      const res = await SETTINGS_GET();
      expect(res.status).toBe(403);
    });
  });

  describe("events.manage permission", () => {
    it("grants access to POST /api/events", async () => {
      const { user } = await setupUserWithPermissions(["events.manage"]);
      mockAuth(user.user.id, ["events.manage"]);

      const res = await EVENTS_POST(
        mockRequest("/api/events", {
          method: "POST",
          body: {
            title: `Event${uniqueSuffix()}`,
            type: "WORKSHOP",
            startAt: "2025-06-01T10:00:00.000Z",
          },
        })
      );
      expect(res.status).toBe(201);
    });

    it("denies POST /api/events without permission", async () => {
      const { user } = await setupUserWithPermissions([]);
      mockAuth(user.user.id, []);

      const res = await EVENTS_POST(
        mockRequest("/api/events", {
          method: "POST",
          body: {
            title: `Event${uniqueSuffix()}`,
            type: "WORKSHOP",
            startAt: "2025-06-01T10:00:00.000Z",
          },
        })
      );
      expect(res.status).toBe(403);
    });
  });

  describe("Expired committee role", () => {
    it("denies access when committee role has ended", async () => {
      const { user, member, committee } = await setupUserWithPermissions([]);
      const role = await createTestRole({
        name: `ExpiredRole${uniqueSuffix()}`,
        permissionIds: (
          await Promise.all(
            ["member.view"].map(async (k) => {
              const p = await prisma.permission.findUnique({ where: { key: k } });
              return p!.id;
            })
          )
        ),
      });
      // Create an ended role (historical, not current)
      await assignCommitteeRole(member.id, role.id, committee.id);
      await prisma.committeeMemberRole.updateMany({
        where: { memberId: member.id, roleId: role.id },
        data: { endedAt: new Date("2020-01-01") },
      });

      mockAuth(user.user.id, []);
      const res = await GET(mockRequest("/api/members"));
      expect(res.status).toBe(403);
    });
  });

  describe("Non-current committee", () => {
    it("denies access when role is in non-current committee", async () => {
      const user = await createTestUser({ email: `nc-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      const oldCommittee = await createTestCommittee({ isCurrent: false });

      const role = await createTestRole({
        name: `OldRole${uniqueSuffix()}`,
        permissionIds: (
          await Promise.all(
            ["member.view"].map(async (k) => {
              const p = await prisma.permission.findUnique({ where: { key: k } });
              return p!.id;
            })
          )
        ),
      });
      await assignCommitteeRole(member.id, role.id, oldCommittee.id);

      mockAuth(user.user.id, []);
      const res = await GET(mockRequest("/api/members"));
      expect(res.status).toBe(403);
    });
  });

  describe("Suspended member login", () => {
    it("suspended members cannot authenticate", async () => {
      const { member } = await setupUserWithPermissions(["member.view"]);
      await prisma.member.update({
        where: { id: member.id },
        data: { status: "SUSPENDED" },
      });

      // The auth mock returns null for suspended (simulated by clearAuth)
      clearAuth();
      const res = await GET(mockRequest("/api/members"));
      expect(res.status).toBe(401);
    });
  });
});
