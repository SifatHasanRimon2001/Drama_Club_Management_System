import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/events/route";
import { GET as GET_ONE, PATCH, DELETE } from "@/app/api/events/[id]/route";
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

describe("Events API", () => {
  let adminUserId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-e-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ["events.manage"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);

    mockAuth(adminUserId, ["events.manage"]);
  });

  describe("GET /api/events", () => {
    it("returns events (excludes DRAFT)", async () => {
      const committee = await createTestCommittee();
      const dept = await createTestDepartment({ committeeId: committee.id });

      await prisma.event.create({
        data: { title: "Public Event", type: "WORKSHOP", status: "UPCOMING", departmentId: dept.id, startAt: new Date("2025-06-01") },
      });
      await prisma.event.create({
        data: { title: "Draft Event", type: "REHEARSAL", status: "DRAFT", startAt: new Date("2025-07-01") },
      });

      const res = await GET(mockRequest("/api/events"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.events.length).toBe(1);
      expect(data.events[0].title).toBe("Public Event");
    });

    it("filters by type", async () => {
      await prisma.event.create({ data: { title: "Workshop", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2025-06-01") } });
      await prisma.event.create({ data: { title: "Rehearsal", type: "REHEARSAL", status: "UPCOMING", startAt: new Date("2025-06-01") } });

      const res = await GET(mockRequest("/api/events", { searchParams: { type: "WORKSHOP" } }));
      const data = await res.json();
      expect(data.events.every((e: { type: string }) => e.type === "WORKSHOP")).toBe(true);
    });

    it("events GET is public (no auth required)", async () => {
      clearAuth();
      const res = await GET(mockRequest("/api/events"));
      expect(res.status).toBe(200);
    });

    it("returns pagination info", async () => {
      const res = await GET(mockRequest("/api/events"));
      const data = await res.json();
      expect(data.pagination).toBeDefined();
    });
  });

  describe("POST /api/events", () => {
    it("creates an event", async () => {
      const req = mockRequest("/api/events", {
        method: "POST",
        body: { title: `Event${uniqueSuffix()}`, type: "PERFORMANCE", startAt: "2025-06-01T10:00:00.000Z" },
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.title).toBeTruthy();
      expect(data.status).toBe("UPCOMING");
    });

    it("creates event with department", async () => {
      const committee = await createTestCommittee();
      const dept = await createTestDepartment({ committeeId: committee.id });

      const res = await POST(
        mockRequest("/api/events", {
          method: "POST",
          body: { title: `DeptEvent${uniqueSuffix()}`, type: "WORKSHOP", startAt: "2025-06-01T10:00:00.000Z", departmentId: dept.id },
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.departmentId).toBe(dept.id);
    });

    it("rejects endAt before startAt", async () => {
      const req = mockRequest("/api/events", {
        method: "POST",
        body: { title: "Bad Times", type: "WORKSHOP", startAt: "2025-06-02T10:00:00.000Z", endAt: "2025-06-01T10:00:00.000Z" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects invalid type", async () => {
      const req = mockRequest("/api/events", {
        method: "POST",
        body: { title: "Bad Type", type: "INVALID", startAt: "2025-06-01T10:00:00.000Z" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await POST(
        mockRequest("/api/events", {
          method: "POST",
          body: { title: "X", type: "WORKSHOP", startAt: "2025-06-01T10:00:00.000Z" },
        })
      );
      expect(res.status).toBe(401);
    });

    it("returns 404 for nonexistent department", async () => {
      const res = await POST(
        mockRequest("/api/events", {
          method: "POST",
          body: { title: "NoDept", type: "WORKSHOP", startAt: "2025-06-01T10:00:00.000Z", departmentId: "clxxxxxxxxxxxxxxxxx" },
        })
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/events/[id]", () => {
    it("returns a single event", async () => {
      const event = await prisma.event.create({
        data: { title: "Single Event", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2025-06-01") },
      });

      const res = await GET_ONE(
        mockRequest(`/api/events/${event.id}`),
        { params: Promise.resolve({ id: event.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe(event.id);
    });

    it("returns 404 for DRAFT event", async () => {
      const event = await prisma.event.create({
        data: { title: "Draft", type: "WORKSHOP", status: "DRAFT", startAt: new Date("2025-06-01") },
      });

      const res = await GET_ONE(
        mockRequest(`/api/events/${event.id}`),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for nonexistent event", async () => {
      const res = await GET_ONE(
        mockRequest("/api/events/fake"),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/events/[id]", () => {
    it("updates event status UPCOMING -> ONGOING", async () => {
      const event = await prisma.event.create({
        data: { title: "Upcoming", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2025-06-01") },
      });

      const res = await PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { status: "ONGOING" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.status).toBe("ONGOING");
    });

    it("transitions ONGOING -> COMPLETED", async () => {
      const event = await prisma.event.create({
        data: { title: "Ongoing", type: "WORKSHOP", status: "ONGOING", startAt: new Date("2025-06-01") },
      });

      const res = await PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { status: "COMPLETED" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe("COMPLETED");
    });

    it("cancels from UPCOMING", async () => {
      const event = await prisma.event.create({
        data: { title: "Cancel", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2025-06-01") },
      });

      const res = await PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { status: "CANCELLED" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe("CANCELLED");
    });

    it("rejects COMPLETED -> UPCOMING", async () => {
      const event = await prisma.event.create({
        data: { title: "Completed", type: "WORKSHOP", status: "COMPLETED", startAt: new Date("2025-06-01") },
      });

      const res = await PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { status: "UPCOMING" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("rejects CANCELLED -> UPCOMING", async () => {
      const event = await prisma.event.create({
        data: { title: "Cancelled", type: "WORKSHOP", status: "CANCELLED", startAt: new Date("2025-06-01") },
      });

      const res = await PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { status: "UPCOMING" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent event", async () => {
      const res = await PATCH(
        mockRequest("/api/events/fake", { method: "PATCH", body: { title: "X" } }),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("updates event title", async () => {
      const event = await prisma.event.create({
        data: { title: "Old Title", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2025-06-01") },
      });

      const res = await PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { title: "New Title" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(200);
      expect((await res.json()).title).toBe("New Title");
    });
  });

  describe("DELETE /api/events/[id]", () => {
    it("deletes an event", async () => {
      const event = await prisma.event.create({
        data: { title: "To Delete", type: "AUDITION", status: "UPCOMING", startAt: new Date("2025-06-01") },
      });

      const res = await DELETE(
        mockRequest(`/api/events/${event.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(200);

      const deleted = await prisma.event.findUnique({ where: { id: event.id } });
      expect(deleted).toBeNull();
    });

    it("returns 404 for nonexistent event", async () => {
      const res = await DELETE(
        mockRequest("/api/events/fake", { method: "DELETE" }),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const event = await prisma.event.create({
        data: { title: "Auth", type: "WORKSHOP", status: "UPCOMING", startAt: new Date("2025-06-01") },
      });
      const res = await DELETE(
        mockRequest(`/api/events/${event.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(401);
    });
  });
});
