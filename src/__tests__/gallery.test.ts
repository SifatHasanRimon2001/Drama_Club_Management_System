import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/gallery/route";
import { GET as GET_ITEMS, POST as POST_ITEMS } from "@/app/api/gallery/items/route";
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

describe("Gallery API", () => {
  let adminUserId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-g-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ["gallery.upload", "gallery.manage"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);

    mockAuth(adminUserId, ["gallery.upload", "gallery.manage"]);
  });

  describe("GET /api/gallery", () => {
    it("returns albums", async () => {
      await prisma.galleryAlbum.create({ data: { name: "Test Album", category: "PRODUCTIONS" } });

      const res = await GET(mockRequest("/api/gallery"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by category", async () => {
      await prisma.galleryAlbum.create({ data: { name: "Prod", category: "PRODUCTIONS" } });
      await prisma.galleryAlbum.create({ data: { name: "Work", category: "WORKSHOPS" } });

      const res = await GET(mockRequest("/api/gallery", { searchParams: { category: "PRODUCTIONS" } }));
      const data = await res.json();
      expect(data.every((a: { category: string }) => a.category === "PRODUCTIONS")).toBe(true);
    });

    it("albums GET requires auth", async () => {
      clearAuth();
      const res = await GET(mockRequest("/api/gallery"));
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/gallery", () => {
    it("creates an album", async () => {
      const res = await POST(
        mockRequest("/api/gallery", {
          method: "POST",
          body: { name: `Album${uniqueSuffix()}`, category: "WORKSHOPS" },
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.name).toBeTruthy();
      expect(data.category).toBe("WORKSHOPS");
    });

    it("creates album with department", async () => {
      const committee = await createTestCommittee();
      const dept = await createTestDepartment({ committeeId: committee.id });

      const res = await POST(
        mockRequest("/api/gallery", {
          method: "POST",
          body: { name: `DeptAlbum${uniqueSuffix()}`, category: "REHEARSALS", departmentId: dept.id },
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.departmentId).toBe(dept.id);
    });

    it("rejects invalid category", async () => {
      const res = await POST(
        mockRequest("/api/gallery", {
          method: "POST",
          body: { name: "Bad", category: "INVALID" },
        })
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent department", async () => {
      const res = await POST(
        mockRequest("/api/gallery", {
          method: "POST",
          body: { name: "NoDept", category: "PRODUCTIONS", departmentId: "clxxxxxxxxxxxxxxxxx" },
        })
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await POST(
        mockRequest("/api/gallery", {
          method: "POST",
          body: { name: "X", category: "PRODUCTIONS" },
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/gallery/items", () => {
    it("creates a gallery item", async () => {
      const album = await prisma.galleryAlbum.create({ data: { name: "Item Album", category: "REHEARSALS" } });

      const res = await POST_ITEMS(
        mockRequest("/api/gallery/items", {
          method: "POST",
          body: { albumId: album.id, r2Key: `gallery/${uniqueSuffix()}.jpg`, fileName: "photo.jpg", type: "IMAGE" },
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.r2Key).toBeTruthy();
      expect(data.type).toBe("IMAGE");
    });

    it("creates item with caption", async () => {
      const album = await prisma.galleryAlbum.create({ data: { name: "Caption", category: "FESTIVALS" } });

      const res = await POST_ITEMS(
        mockRequest("/api/gallery/items", {
          method: "POST",
          body: { albumId: album.id, r2Key: `cap/${uniqueSuffix()}.jpg`, fileName: "cap.jpg", type: "IMAGE", caption: "Test caption" },
        })
      );
      const data = await res.json();
      expect(data.caption).toBe("Test caption");
    });

    it("rejects missing r2Key", async () => {
      const album = await prisma.galleryAlbum.create({ data: { name: "No Key", category: "FESTIVALS" } });
      const res = await POST_ITEMS(
        mockRequest("/api/gallery/items", {
          method: "POST",
          body: { albumId: album.id, fileName: "x.jpg", type: "IMAGE" },
        })
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent album", async () => {
      const res = await POST_ITEMS(
        mockRequest("/api/gallery/items", {
          method: "POST",
          body: { albumId: "cl00000000000000000000000", r2Key: "x.jpg", fileName: "x.jpg", type: "IMAGE" },
        })
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/gallery/items", () => {
    it("returns gallery items for an album", async () => {
      const album = await prisma.galleryAlbum.create({ data: { name: "Items Album", category: "BEHIND_THE_SCENES" } });
      await prisma.galleryItem.create({
        data: { albumId: album.id, r2Key: `test/${uniqueSuffix()}.jpg`, fileName: "test.jpg", type: "IMAGE", uploadedById: adminUserId },
      });

      const res = await GET_ITEMS(
        mockRequest("/api/gallery/items", { searchParams: { albumId: album.id } })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items).toBeDefined();
      expect(data.items.length).toBe(1);
      expect(data.pagination).toBeDefined();
    });

    it("gallery items GET is public", async () => {
      clearAuth();
      const res = await GET_ITEMS(mockRequest("/api/gallery/items"));
      expect(res.status).toBe(200);
    });

    it("returns pagination info", async () => {
      const res = await GET_ITEMS(mockRequest("/api/gallery/items"));
      const data = await res.json();
      expect(data.pagination).toHaveProperty("total");
      expect(data.pagination).toHaveProperty("totalPages");
    });
  });
});
