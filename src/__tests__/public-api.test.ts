import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/public/committee/route";
import { GET as DEPT_GET } from "@/app/api/public/departments/route";
import { GET as EVENTS_GET } from "@/app/api/public/events/route";
import { GET as HOME_GET } from "@/app/api/public/home/route";
import { GET as UPDATES_GET } from "@/app/api/public/updates/route";
import { GET as GALLERY_GET } from "@/app/api/public/gallery/route";
import { GET as GALLERY_ID_GET } from "@/app/api/public/gallery/[id]/route";
import { GET as RECRUITMENT_GET } from "@/app/api/public/recruitment/route";
import { GET as PRODUCTIONS_GET } from "@/app/api/public/productions/route";
import { GET as ABOUT_GET } from "@/app/api/public/about/route";
import {
  mockRequest,
  clearAuth,
  cleanupTestData,
  seedPermissions,
  createTestUser,
  createTestMember,
  createTestCommittee,
  createTestDepartment,
  uniqueSuffix,
} from "./helpers";
import prisma from "@/lib/prisma";

describe("Public API Endpoints", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
    clearAuth();
  });

  describe("GET /api/public/home", () => {
    it("returns club summary", async () => {
      const res = await HOME_GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("committee");
      expect(data).toHaveProperty("departments");
      expect(data).toHaveProperty("recentUpdates");
      expect(data).toHaveProperty("upcomingEvents");
    });

    it("strips emails from committee members", async () => {
      const committee = await createTestCommittee({ isCurrent: true });
      const user = await createTestUser({ email: `pubmember-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id });
      const role = await prisma.role.create({ data: { name: `PubRole-${uniqueSuffix()}` } });
      await prisma.committeeMemberRole.create({
        data: { committeeId: committee.id, memberId: member.id, roleId: role.id },
      });

      const res = await HOME_GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      if (data.committee && data.committee.memberRoles.length > 0) {
        const memberData = data.committee.memberRoles[0].member.user;
        expect(memberData).not.toHaveProperty("email");
      }
    });
  });

  describe("GET /api/public/committee", () => {
    it("returns current committee", async () => {
      await createTestCommittee({ isCurrent: true });
      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("id");
    });

    it("returns 404 when no current committee", async () => {
      const res = await GET();
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/public/departments", () => {
    it("returns departments", async () => {
      const c = await createTestCommittee({ isCurrent: true });
      await createTestDepartment({ committeeId: c.id });

      const res = await DEPT_GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it("returns empty array when no departments", async () => {
      const res = await DEPT_GET();
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe("GET /api/public/events", () => {
    it("returns upcoming events", async () => {
      await prisma.event.create({
        data: { title: "Public Event", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2030-12-01") },
      });

      const res = await EVENTS_GET(mockRequest("/api/public/events"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it("excludes DRAFT events", async () => {
      await prisma.event.create({
        data: { title: "Draft", type: "WORKSHOP", status: "DRAFT", startAt: new Date("2030-12-01") },
      });

      const res = await EVENTS_GET(mockRequest("/api/public/events"));
      const data = await res.json();
      expect(data.length).toBe(0);
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await prisma.event.create({
          data: { title: `Event${i}`, type: "WORKSHOP", status: "UPCOMING", startAt: new Date(`2030-12-0${i + 1}`) },
        });
      }

      const res = await EVENTS_GET(mockRequest("/api/public/events", { searchParams: { limit: "2" } }));
      const data = await res.json();
      expect(data.length).toBe(2);
    });
  });

  describe("GET /api/public/updates", () => {
    it("returns published updates", async () => {
      const admin = await createTestUser({ email: `pub-u-${uniqueSuffix()}@test.com` });
      await prisma.clubUpdate.create({
        data: { title: "Public Update", bodyRichText: "<p>Content</p>", category: "ANNOUNCEMENT", authorId: admin.user.id, publishedAt: new Date() },
      });

      const res = await UPDATES_GET(mockRequest("/api/public/updates"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it("excludes unpublished updates", async () => {
      const admin = await createTestUser({ email: `draft-${uniqueSuffix()}@test.com` });
      await prisma.clubUpdate.create({
        data: { title: "Draft", bodyRichText: "<p>Draft</p>", category: "NOTICE", authorId: admin.user.id },
      });

      const res = await UPDATES_GET(mockRequest("/api/public/updates"));
      const data = await res.json();
      expect(data.length).toBe(0);
    });
  });

  describe("GET /api/public/gallery", () => {
    it("returns gallery albums", async () => {
      await prisma.galleryAlbum.create({ data: { name: "Public Album", category: "PRODUCTIONS" } });

      const res = await GALLERY_GET(mockRequest("/api/public/gallery"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe("GET /api/public/gallery/[id]", () => {
    it("returns album with items", async () => {
      const album = await prisma.galleryAlbum.create({ data: { name: "Album Detail", category: "WORKSHOPS" } });
      await prisma.galleryItem.create({
        data: { albumId: album.id, r2Key: "test.jpg", fileName: "test.jpg", type: "IMAGE", uploadedById: (await createTestUser()).user.id },
      });

      const res = await GALLERY_ID_GET(
        mockRequest(`/api/public/gallery/${album.id}`),
        { params: Promise.resolve({ id: album.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe(album.id);
      expect(data.items).toBeDefined();
      expect(data.items.length).toBe(1);
    });

    it("returns 404 for nonexistent album", async () => {
      const res = await GALLERY_ID_GET(
        mockRequest("/api/public/gallery/fake"),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/public/recruitment", () => {
    it("returns live registration windows", async () => {
      await prisma.registrationWindow.create({
        data: { title: "Live Recruitment", description: "Join us!", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
      });

      const res = await RECRUITMENT_GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].title).toBe("Live Recruitment");
    });

    it("excludes non-LIVE windows", async () => {
      await prisma.registrationWindow.create({
        data: { title: "Draft", description: "d", startDate: new Date(), endDate: new Date(), status: "DRAFT" },
      });

      const res = await RECRUITMENT_GET();
      const data = await res.json();
      expect(data.length).toBe(0);
    });

    it("excludes LIVE windows outside the open date range", async () => {
      await prisma.registrationWindow.create({
        data: {
          title: "Expired",
          description: "Already closed",
          startDate: new Date("2020-01-01"),
          endDate: new Date("2020-12-31"),
          status: "LIVE",
        },
      });
      await prisma.registrationWindow.create({
        data: {
          title: "Not yet open",
          description: "Starts in the future",
          startDate: new Date("2099-01-01"),
          endDate: new Date("2099-12-31"),
          status: "LIVE",
        },
      });

      const res = await RECRUITMENT_GET();
      const data = await res.json();
      expect(data.length).toBe(0);
    });
  });

  describe("GET /api/public/productions", () => {
    it("returns performance events", async () => {
      await prisma.event.create({
        data: { title: "Show", type: "PERFORMANCE", status: "UPCOMING", startAt: new Date("2030-12-01") },
      });
      await prisma.event.create({
        data: { title: "Workshop", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2030-12-01") },
      });

      const res = await PRODUCTIONS_GET(mockRequest("/api/public/productions"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.length).toBe(1);
      expect(data[0].type).toBe("PERFORMANCE");
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await prisma.event.create({
          data: { title: `Show${i}`, type: "PERFORMANCE", status: "UPCOMING", startAt: new Date(`2030-12-0${i + 1}`) },
        });
      }

      const res = await PRODUCTIONS_GET(mockRequest("/api/public/productions", { searchParams: { limit: "3" } }));
      const data = await res.json();
      expect(data.length).toBe(3);
    });
  });

  describe("GET /api/public/about", () => {
    it("returns club info", async () => {
      const res = await ABOUT_GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("clubName");
      expect(data).toHaveProperty("clubDescription");
      expect(data).toHaveProperty("departmentCount");
      expect(data).toHaveProperty("activeMemberCount");
    });

    it("returns defaults when no settings", async () => {
      const res = await ABOUT_GET();
      const data = await res.json();
      expect(data.clubName).toBe("BRAC University Drama Club");
    });

    it("returns configured settings and real counts", async () => {
      await prisma.systemSetting.createMany({
        data: [
          { key: "clubName", value: "Starlight Drama Society" },
          { key: "clubDescription", value: "Community theatre" },
          { key: "logoUrl", value: "https://example.com/logo.png" },
        ],
      });
      const c = await createTestCommittee({ isCurrent: true });
      await createTestDepartment({ committeeId: c.id });
      const u = await createTestUser({ email: `about-${uniqueSuffix()}@test.com` });
      await createTestMember({ userId: u.user.id, status: "ACTIVE" });

      const res = await ABOUT_GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.clubName).toBe("Starlight Drama Society");
      expect(data.clubDescription).toBe("Community theatre");
      expect(data.logoUrl).toBe("https://example.com/logo.png");
      expect(data.departmentCount).toBe(1);
      expect(data.activeMemberCount).toBe(1);
    });
  });
});
