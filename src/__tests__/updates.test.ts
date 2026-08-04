import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/updates/route";
import { GET as GET_ONE, PATCH, DELETE } from "@/app/api/updates/[id]/route";
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

describe("Club Updates API", () => {
  let adminUserId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-u-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ["updates.publish"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);

    mockAuth(adminUserId, ["updates.publish"]);
  });

  describe("GET /api/updates", () => {
    it("returns published updates", async () => {
      await prisma.clubUpdate.create({
        data: { title: "Published", bodyRichText: "<p>Content</p>", category: "ANNOUNCEMENT", authorId: adminUserId, publishedAt: new Date() },
      });
      await prisma.clubUpdate.create({
        data: { title: "Draft", bodyRichText: "<p>Draft</p>", category: "NOTICE", authorId: adminUserId },
      });

      const res = await GET(mockRequest("/api/updates"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.updates.length).toBe(1);
      expect(data.updates[0].title).toBe("Published");
    });

    it("updates GET is public", async () => {
      clearAuth();
      const res = await GET(mockRequest("/api/updates"));
      expect(res.status).toBe(200);
    });

    it("returns pagination info", async () => {
      const res = await GET(mockRequest("/api/updates"));
      const data = await res.json();
      expect(data.pagination).toBeDefined();
    });

    it("filters by category", async () => {
      await prisma.clubUpdate.create({
        data: { title: "A", bodyRichText: "<p>A</p>", category: "ANNOUNCEMENT", authorId: adminUserId, publishedAt: new Date() },
      });
      await prisma.clubUpdate.create({
        data: { title: "N", bodyRichText: "<p>N</p>", category: "NOTICE", authorId: adminUserId, publishedAt: new Date() },
      });

      const res = await GET(mockRequest("/api/updates", { searchParams: { category: "ANNOUNCEMENT" } }));
      const data = await res.json();
      expect(data.updates.every((u: { category: string }) => u.category === "ANNOUNCEMENT")).toBe(true);
    });
  });

  describe("POST /api/updates", () => {
    it("creates a club update", async () => {
      const res = await POST(
        mockRequest("/api/updates", {
          method: "POST",
          body: { title: `Update${uniqueSuffix()}`, bodyRichText: "<p>New content</p>", category: "ACHIEVEMENT" },
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.title).toBeTruthy();
      expect(data.category).toBe("ACHIEVEMENT");
    });

    it("creates with publishedAt set", async () => {
      const res = await POST(
        mockRequest("/api/updates", {
          method: "POST",
          body: { title: `Pub${uniqueSuffix()}`, bodyRichText: "<p>Published</p>", category: "NOTICE", publishedAt: new Date().toISOString() },
        })
      );
      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data.publishedAt).not.toBeNull();
    });

    it("rejects missing bodyRichText", async () => {
      const res = await POST(
        mockRequest("/api/updates", {
          method: "POST",
          body: { title: "No Body", category: "NOTICE" },
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects invalid category", async () => {
      const res = await POST(
        mockRequest("/api/updates", {
          method: "POST",
          body: { title: "Bad", bodyRichText: "<p>X</p>", category: "INVALID" },
        })
      );
      expect(res.status).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await POST(
        mockRequest("/api/updates", {
          method: "POST",
          body: { title: "X", bodyRichText: "<p>X</p>", category: "NOTICE" },
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/updates/[id]", () => {
    it("returns a published update", async () => {
      const update = await prisma.clubUpdate.create({
        data: { title: "Published", bodyRichText: "<p>Content</p>", category: "ANNOUNCEMENT", authorId: adminUserId, publishedAt: new Date() },
      });

      const res = await GET_ONE(
        mockRequest(`/api/updates/${update.id}`),
        { params: Promise.resolve({ id: update.id }) }
      );
      expect(res.status).toBe(200);
      expect((await res.json()).id).toBe(update.id);
    });

    it("returns 404 for unpublished update", async () => {
      const update = await prisma.clubUpdate.create({
        data: { title: "Draft", bodyRichText: "<p>Draft</p>", category: "NOTICE", authorId: adminUserId },
      });

      const res = await GET_ONE(
        mockRequest(`/api/updates/${update.id}`),
        { params: Promise.resolve({ id: update.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for nonexistent update", async () => {
      const res = await GET_ONE(
        mockRequest("/api/updates/fake"),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/updates/[id]", () => {
    it("publishes an update", async () => {
      const update = await prisma.clubUpdate.create({
        data: { title: "To Publish", bodyRichText: "<p>Content</p>", category: "ANNOUNCEMENT", authorId: adminUserId },
      });

      const res = await PATCH(
        mockRequest(`/api/updates/${update.id}`, {
          method: "PATCH",
          body: { publishedAt: new Date().toISOString() },
        }),
        { params: Promise.resolve({ id: update.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.publishedAt).not.toBeNull();
    });

    it("updates title", async () => {
      const update = await prisma.clubUpdate.create({
        data: { title: "Old", bodyRichText: "<p>Content</p>", category: "NOTICE", authorId: adminUserId, publishedAt: new Date() },
      });

      const res = await PATCH(
        mockRequest(`/api/updates/${update.id}`, { method: "PATCH", body: { title: "New" } }),
        { params: Promise.resolve({ id: update.id }) }
      );
      expect(res.status).toBe(200);
      expect((await res.json()).title).toBe("New");
    });

    it("returns 404 for nonexistent update", async () => {
      const res = await PATCH(
        mockRequest("/api/updates/fake", { method: "PATCH", body: { title: "X" } }),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const update = await prisma.clubUpdate.create({
        data: { title: "Auth", bodyRichText: "<p>Content</p>", category: "NOTICE", authorId: adminUserId },
      });
      const res = await PATCH(
        mockRequest(`/api/updates/${update.id}`, { method: "PATCH", body: { title: "X" } }),
        { params: Promise.resolve({ id: update.id }) }
      );
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/updates/[id]", () => {
    it("deletes an update", async () => {
      const update = await prisma.clubUpdate.create({
        data: { title: "To Delete", bodyRichText: "<p>Bye</p>", category: "NOTICE", authorId: adminUserId },
      });

      const res = await DELETE(
        mockRequest(`/api/updates/${update.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: update.id }) }
      );
      expect(res.status).toBe(200);

      const deleted = await prisma.clubUpdate.findUnique({ where: { id: update.id } });
      expect(deleted).toBeNull();
    });

    it("returns 404 for nonexistent update", async () => {
      const res = await DELETE(
        mockRequest("/api/updates/fake", { method: "DELETE" }),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const update = await prisma.clubUpdate.create({
        data: { title: "Auth", bodyRichText: "<p>Content</p>", category: "NOTICE", authorId: adminUserId },
      });
      const res = await DELETE(
        mockRequest(`/api/updates/${update.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: update.id }) }
      );
      expect(res.status).toBe(401);
    });
  });
});
