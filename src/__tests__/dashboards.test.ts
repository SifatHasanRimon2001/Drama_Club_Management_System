import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/dashboard/admin/route";
import { GET as DEPT_DASH } from "@/app/api/dashboard/department/route";
import { GET as MEMBER_DASH } from "@/app/api/dashboard/member/route";
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

describe("Dashboard API", () => {
  let adminUserId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-db-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ["member.view", "events.manage", "registration.manage", "updates.publish", "permissions.manage"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);

    mockAuth(adminUserId, ["member.view", "events.manage", "registration.manage", "updates.publish", "permissions.manage"]);
  });

  describe("GET /api/dashboard/admin", () => {
    it("returns admin dashboard stats", async () => {
      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("members");
      expect(data).toHaveProperty("registrations");
      expect(data).toHaveProperty("upcomingEvents");
      expect(data).toHaveProperty("recentGalleryItems");
      expect(data).toHaveProperty("pendingPromotions");
    });

    it("returns correct counts with data", async () => {
      const committee = await createTestCommittee();
      await createTestDepartment({ committeeId: committee.id });
      const u = await createTestUser({ email: `dash-${uniqueSuffix()}@test.com` });
      await createTestMember({ userId: u.user.id, status: "ACTIVE" });

      await prisma.event.create({
        data: { title: "Event", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2025-06-01") },
      });

      const res = await GET();
      const data = await res.json();

      expect(data.members.total).toBeGreaterThanOrEqual(2);
      expect(data.upcomingEvents).toBeDefined();
    });

    it("returns empty state correctly", async () => {
      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.members.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(data.registrations)).toBe(true);
      expect(Array.isArray(data.upcomingEvents)).toBe(true);
      expect(Array.isArray(data.recentGalleryItems)).toBe(true);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns 403 when missing permissions.manage", async () => {
      const user = await createTestUser({ email: `noperm-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, []);
      const res = await GET();
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/dashboard/department", () => {
    it("returns department dashboard", async () => {
      const committee = await createTestCommittee({ isCurrent: true });
      const dept = await createTestDepartment({ committeeId: committee.id });
      const member = await prisma.member.findUnique({ where: { userId: adminUserId } });
      await prisma.memberDepartment.create({
        data: { memberId: member!.id, departmentId: dept.id },
      });

      const res = await DEPT_DASH(
        mockRequest("/api/dashboard/department", { searchParams: { departmentId: dept.id } })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("department");
      expect(data).toHaveProperty("members");
      expect(data).toHaveProperty("tasks");
      expect(data).toHaveProperty("events");
      expect(data).toHaveProperty("taskCounts");
      expect(data).toHaveProperty("recruitment");
    });

    it("returns 400 when departmentId is missing", async () => {
      const res = await DEPT_DASH(mockRequest("/api/dashboard/department"));
      expect(res.status).toBe(400);
    });

    it("returns 403 for department user has no access to", async () => {
      const res = await DEPT_DASH(
        mockRequest("/api/dashboard/department", { searchParams: { departmentId: "clxxxxxxxxxxxxxxxxx" } })
      );
      expect(res.status).toBe(403);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await DEPT_DASH(
        mockRequest("/api/dashboard/department", { searchParams: { departmentId: "x" } })
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/dashboard/member", () => {
    it("returns member dashboard", async () => {
      const res = await MEMBER_DASH();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("member");
      expect(data).toHaveProperty("upcomingEvents");
      expect(data).toHaveProperty("recentNotifications");
      expect(data).toHaveProperty("departments");
    });

    it("returns member data when user has member profile", async () => {
      const res = await MEMBER_DASH();
      const data = await res.json();

      expect(data.user).toHaveProperty("id");
      expect(data.user).toHaveProperty("name");
      expect(data.user).toHaveProperty("email");
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await MEMBER_DASH();
      expect(res.status).toBe(401);
    });
  });
});
