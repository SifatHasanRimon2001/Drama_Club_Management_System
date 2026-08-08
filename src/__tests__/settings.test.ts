import { describe, it, expect, beforeEach } from "vitest";
import { GET, PATCH } from "@/app/api/settings/route";
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

describe("Settings API", () => {
  let adminUserId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-s-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ["settings.manage"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);

    mockAuth(adminUserId, ["settings.manage"]);
  });

  describe("GET /api/settings", () => {
    it("returns settings as key-value map", async () => {
      await prisma.systemSetting.create({ data: { key: "clubName", value: "BRAC University Drama Club" } });

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.clubName).toBe("BRAC University Drama Club");
    });

    it("returns empty object when no settings", async () => {
      const res = await GET();
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(typeof data).toBe("object");
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await GET();
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/settings", () => {
    it("upserts settings", async () => {
      const res = await PATCH(
        mockRequest("/api/settings", {
          method: "PATCH",
          body: { clubName: "New Name", clubDescription: "Best club" },
        })
      );
      expect(res.status).toBe(200);

      const nameSetting = await prisma.systemSetting.findUnique({ where: { key: "clubName" } });
      expect(nameSetting!.value).toBe("New Name");

      const descSetting = await prisma.systemSetting.findUnique({ where: { key: "clubDescription" } });
      expect(descSetting!.value).toBe("Best club");
    });

    it("updates existing settings", async () => {
      await prisma.systemSetting.create({ data: { key: "clubName", value: "Old Name" } });

      const res = await PATCH(
        mockRequest("/api/settings", {
          method: "PATCH",
          body: { clubName: "Updated Name" },
        })
      );
      expect(res.status).toBe(200);

      const setting = await prisma.systemSetting.findUnique({ where: { key: "clubName" } });
      expect(setting!.value).toBe("Updated Name");
    });

    it("rejects invalid setting keys", async () => {
      const res = await PATCH(
        mockRequest("/api/settings", {
          method: "PATCH",
          body: { invalidKey: "value" },
        })
      );
      expect(res.status).toBe(400);
    });

    it("sets all allowed keys", async () => {
      const res = await PATCH(
        mockRequest("/api/settings", {
          method: "PATCH",
          body: {
            clubName: "Test Club",
            clubDescription: "A great club",
            contactEmail: "test@test.com",
            contactPhone: "555-1234",
            registrationEnabled: true,
            maintenanceMode: false,
          },
        })
      );
      expect(res.status).toBe(200);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await PATCH(
        mockRequest("/api/settings", {
          method: "PATCH",
          body: { clubName: "X" },
        })
      );
      expect(res.status).toBe(401);
    });
  });
});
