import { describe, it, expect, beforeEach } from "vitest";
import { GET as MEMBERS_GET } from "@/app/api/members/route";
import { GET as EVENTS_GET } from "@/app/api/events/route";
import { GET as UPDATES_GET } from "@/app/api/updates/route";
import { GET as GALLERY_GET } from "@/app/api/gallery/route";
import { GET as TASKS_GET } from "@/app/api/departments/[id]/tasks/route";
import { GET as RW_GET } from "@/app/api/registration-windows/route";
import { GET as RW_APPLICANTS_GET } from "@/app/api/registration-windows/[id]/applicants/route";
import { GET as APPLICANTS_GET } from "@/app/api/applicants/route";
import { GET as PROMOS_GET } from "@/app/api/promotions/route";
import { GET as PUBLIC_GALLERY_GET } from "@/app/api/public/gallery/route";
import { GET as PUBLIC_UPDATES_GET } from "@/app/api/public/updates/route";
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

describe("Enum Query Param Validation", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  async function setupAdmin() {
    const allPerms = [
      "member.view", "member.create", "member.edit",
      "department.view", "department.manage",
      "committee.manage",
      "registration.manage", "registration.review",
      "promotion.submit", "promotion.approve",
      "gallery.upload", "gallery.manage",
      "updates.publish", "events.manage",
      "permissions.manage", "settings.manage",
    ];
    const user = await createTestUser({ email: `admin-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const role = await createTestRole({
      name: `EnumAdmin-${uniqueSuffix()}`,
      permissionIds: (await Promise.all(
        allPerms.map(async (k) => {
          const p = await prisma.permission.findUnique({ where: { key: k } });
          return p!.id;
        })
      )),
    });
    await assignCommitteeRole(member.id, role.id, committee.id);
    mockAuth(user.user.id, allPerms);
    return { user, member, committee };
  }

  describe("Members - status filter", () => {
    it("returns 400 for invalid status enum", async () => {
      await setupAdmin();
      const res = await MEMBERS_GET(mockRequest("/api/members", { searchParams: { status: "INVALID_STATUS" } }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid status");
    });

    it("returns 200 for valid status enum", async () => {
      const { member } = await setupAdmin();
      const res = await MEMBERS_GET(mockRequest("/api/members", { searchParams: { status: "ACTIVE" } }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.members.some((m: { id: string }) => m.id === member.id)).toBe(true);
    });

    it("returns 200 with no status filter", async () => {
      await setupAdmin();
      const res = await MEMBERS_GET(mockRequest("/api/members"));
      expect(res.status).toBe(200);
    });
  });

  describe("Events - type filter", () => {
    it("returns 400 for invalid type enum", async () => {
      await setupAdmin();
      const res = await EVENTS_GET(mockRequest("/api/events", { searchParams: { type: "INVALID_TYPE" } }));
      expect(res.status).toBe(400);
    });

    it("returns 200 for valid type enum", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      await prisma.event.create({
        data: { title: `W-${uniqueSuffix()}`, type: "WORKSHOP", status: "UPCOMING", departmentId: dept.id, startAt: new Date(Date.now() + 86400000) },
      });
      const res = await EVENTS_GET(mockRequest("/api/events", { searchParams: { type: "WORKSHOP" } }));
      expect(res.status).toBe(200);
    });
  });

  describe("Updates - category filter", () => {
    it("returns 400 for invalid category enum", async () => {
      const res = await UPDATES_GET(mockRequest("/api/updates", { searchParams: { category: "INVALID_CAT" } }));
      expect(res.status).toBe(400);
    });

    it("returns 200 for valid category enum", async () => {
      await setupAdmin();
      await prisma.clubUpdate.create({
        data: { title: `N-${uniqueSuffix()}`, bodyRichText: "Body", category: "NOTICE", publishedAt: new Date(), authorId: (await prisma.user.findFirst())!.id },
      });
      const res = await UPDATES_GET(mockRequest("/api/updates", { searchParams: { category: "NOTICE" } }));
      expect(res.status).toBe(200);
    });
  });

  describe("Gallery (auth) - category filter", () => {
    it("returns 400 for invalid category enum", async () => {
      await setupAdmin();
      const res = await GALLERY_GET(mockRequest("/api/gallery", { searchParams: { category: "INVALID_CAT" } }));
      expect(res.status).toBe(400);
    });

    it("returns 200 for valid category enum", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      await prisma.galleryAlbum.create({ data: { name: `A-${uniqueSuffix()}`, category: "PRODUCTIONS", departmentId: dept.id } });
      const res = await GALLERY_GET(mockRequest("/api/gallery", { searchParams: { category: "PRODUCTIONS" } }));
      expect(res.status).toBe(200);
    });
  });

  describe("Tasks - status filter", () => {
    it("returns 400 for invalid status enum", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const res = await TASKS_GET(
        mockRequest(`/api/departments/${dept.id}/tasks`, { searchParams: { status: "INVALID" } }),
        { params: Promise.resolve({ id: dept.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("returns 200 for valid status enum", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      await prisma.task.create({ data: { departmentId: dept.id, title: `T-${uniqueSuffix()}`, status: "TODO" } });
      const res = await TASKS_GET(
        mockRequest(`/api/departments/${dept.id}/tasks`, { searchParams: { status: "TODO" } }),
        { params: Promise.resolve({ id: dept.id }) }
      );
      expect(res.status).toBe(200);
    });
  });

  describe("Registration Windows - status filter", () => {
    it("returns 400 for invalid status enum", async () => {
      await setupAdmin();
      const res = await RW_GET(mockRequest("/api/registration-windows", { searchParams: { status: "INVALID" } }));
      expect(res.status).toBe(400);
    });

    it("returns 200 for valid status enum", async () => {
      await setupAdmin();
      await prisma.registrationWindow.create({
        data: { title: `RW-${uniqueSuffix()}`, description: "Test", startDate: new Date(), endDate: new Date(Date.now() + 86400000), status: "LIVE" },
      });
      const res = await RW_GET(mockRequest("/api/registration-windows", { searchParams: { status: "LIVE" } }));
      expect(res.status).toBe(200);
    });
  });

  describe("Registration Window Applicants - status filter", () => {
    it("returns 400 for invalid status enum", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({
        data: { title: `RW-${uniqueSuffix()}`, description: "Test", startDate: new Date(), endDate: new Date(Date.now() + 86400000), status: "LIVE" },
      });
      const res = await RW_APPLICANTS_GET(
        mockRequest(`/api/registration-windows/${rw.id}/applicants`, { searchParams: { status: "INVALID" } }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("returns 200 for valid status enum", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({
        data: { title: `RW-${uniqueSuffix()}`, description: "Test", startDate: new Date(), endDate: new Date(Date.now() + 86400000), status: "LIVE" },
      });
      await prisma.applicant.create({
        data: { registrationWindowId: rw.id, name: "T", email: `a-${uniqueSuffix()}@test.com`, phone: "1", studentId: "S1", departmentPrefs: [], status: "SUBMITTED" },
      });
      const res = await RW_APPLICANTS_GET(
        mockRequest(`/api/registration-windows/${rw.id}/applicants`, { searchParams: { status: "SUBMITTED" } }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(200);
    });
  });

  describe("Applicants - status filter", () => {
    it("returns 400 for invalid status enum", async () => {
      await setupAdmin();
      const res = await APPLICANTS_GET(mockRequest("/api/applicants", { searchParams: { status: "INVALID" } }));
      expect(res.status).toBe(400);
    });

    it("returns 200 for valid status enum", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({
        data: { title: `RW-${uniqueSuffix()}`, description: "Test", startDate: new Date(), endDate: new Date(Date.now() + 86400000), status: "LIVE" },
      });
      await prisma.applicant.create({
        data: { registrationWindowId: rw.id, name: "T", email: `a2-${uniqueSuffix()}@test.com`, phone: "1", studentId: "S2", departmentPrefs: [], status: "ACCEPTED" },
      });
      const res = await APPLICANTS_GET(mockRequest("/api/applicants", { searchParams: { status: "ACCEPTED" } }));
      expect(res.status).toBe(200);
    });
  });

  describe("Promotions - status filter", () => {
    it("returns 400 for invalid status enum", async () => {
      await setupAdmin();
      const res = await PROMOS_GET(mockRequest("/api/promotions", { searchParams: { status: "INVALID" } }));
      expect(res.status).toBe(400);
    });

    it("returns 200 for valid status enum", async () => {
      const { member } = await setupAdmin();
      const role = await createTestRole({ name: `R-${uniqueSuffix()}` });
      await prisma.promotionRequest.create({
        data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: role.id, reason: "Test", status: "DRAFT", submittedById: (await prisma.user.findFirst())!.id },
      });
      const res = await PROMOS_GET(mockRequest("/api/promotions", { searchParams: { status: "DRAFT" } }));
      expect(res.status).toBe(200);
    });
  });

  describe("Public Gallery - category filter", () => {
    it("returns 400 for invalid category enum", async () => {
      clearAuth();
      const res = await PUBLIC_GALLERY_GET(mockRequest("/api/public/gallery", { searchParams: { category: "INVALID_CAT" } }));
      expect(res.status).toBe(400);
    });

    it("returns 200 for valid category enum", async () => {
      clearAuth();
      await prisma.galleryAlbum.create({ data: { name: `PA-${uniqueSuffix()}`, category: "WORKSHOPS" } });
      const res = await PUBLIC_GALLERY_GET(mockRequest("/api/public/gallery", { searchParams: { category: "WORKSHOPS" } }));
      expect(res.status).toBe(200);
    });
  });

  describe("Public Updates - category filter", () => {
    it("returns 400 for invalid category enum", async () => {
      clearAuth();
      const res = await PUBLIC_UPDATES_GET(mockRequest("/api/public/updates", { searchParams: { category: "INVALID_CAT" } }));
      expect(res.status).toBe(400);
    });

    it("returns 200 for valid category enum", async () => {
      clearAuth();
      const user = await createTestUser({ email: `u-${uniqueSuffix()}@test.com` });
      await prisma.clubUpdate.create({
        data: { title: `PU-${uniqueSuffix()}`, bodyRichText: "Body", category: "ANNOUNCEMENT", publishedAt: new Date(), authorId: user.user.id },
      });
      const res = await PUBLIC_UPDATES_GET(mockRequest("/api/public/updates", { searchParams: { category: "ANNOUNCEMENT" } }));
      expect(res.status).toBe(200);
    });
  });

  describe("Error message format", () => {
    it("error message lists valid enum values", async () => {
      await setupAdmin();
      const res = await MEMBERS_GET(mockRequest("/api/members", { searchParams: { status: "BOGUS" } }));
      const data = await res.json();
      expect(data.error).toContain("PENDING");
      expect(data.error).toContain("ACTIVE");
      expect(data.error).toContain("SUSPENDED");
    });
  });
});
