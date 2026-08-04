import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/notifications/route";
import { POST as markRead } from "@/app/api/notifications/[id]/read/route";
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

describe("Notifications API", () => {
  let userId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-n-${uniqueSuffix()}@test.com` });
    userId = admin.user.id;
    const member = await createTestMember({ userId, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({ name: `Admin-${uniqueSuffix()}` });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);

    mockAuth(userId, []);
  });

  async function createTestNotification(data?: { userId?: string; readAt?: Date | null }) {
    const suffix = uniqueSuffix();
    return prisma.notification.create({
      data: {
        userId: data?.userId || userId,
        type: "EVENT",
        title: `Notif${suffix}`,
        message: `Message${suffix}`,
        readAt: data?.readAt ?? null,
      },
    });
  }

  describe("GET /api/notifications", () => {
    it("returns notifications for the user", async () => {
      await createTestNotification();
      await createTestNotification({ readAt: new Date() });

      const res = await GET(mockRequest("/api/notifications"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.notifications).toBeDefined();
      expect(data.unreadCount).toBeDefined();
      expect(data.notifications.length).toBe(2);
      expect(data.unreadCount).toBe(1);
    });

    it("filters by unread only", async () => {
      await createTestNotification();
      await createTestNotification({ readAt: new Date() });

      const res = await GET(
        mockRequest("/api/notifications", { searchParams: { unread: "true" } })
      );
      const data = await res.json();
      expect(data.notifications.length).toBe(1);
    });

    it("returns pagination info", async () => {
      const res = await GET(mockRequest("/api/notifications"));
      const data = await res.json();
      expect(data.pagination).toBeDefined();
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await GET(mockRequest("/api/notifications"));
      expect(res.status).toBe(401);
    });

    it("does not return other users notifications", async () => {
      const otherUser = await createTestUser({ email: `other-${uniqueSuffix()}@test.com` });
      await createTestNotification({ userId: otherUser.user.id });
      await createTestNotification();

      const res = await GET(mockRequest("/api/notifications"));
      const data = await res.json();
      expect(data.notifications.length).toBe(1);
    });
  });

  describe("POST /api/notifications/[id]/read - mark as read", () => {
    it("marks a notification as read", async () => {
      const notif = await createTestNotification();

      const res = await markRead(
        mockRequest(`/api/notifications/${notif.id}/read`, { method: "POST" }),
        { params: Promise.resolve({ id: notif.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.readAt).not.toBeNull();
    });

    it("returns 404 for nonexistent notification", async () => {
      const res = await markRead(
        mockRequest("/api/notifications/nonexistent/read", { method: "POST" }),
        { params: Promise.resolve({ id: "nonexistent" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 for another users notification", async () => {
      const otherUser = await createTestUser({ email: `other-${uniqueSuffix()}@test.com` });
      const notif = await createTestNotification({ userId: otherUser.user.id });

      const res = await markRead(
        mockRequest(`/api/notifications/${notif.id}/read`, { method: "POST" }),
        { params: Promise.resolve({ id: notif.id }) }
      );
      expect(res.status).toBe(403);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const notif = await createTestNotification();
      const res = await markRead(
        mockRequest(`/api/notifications/${notif.id}/read`, { method: "POST" }),
        { params: Promise.resolve({ id: notif.id }) }
      );
      expect(res.status).toBe(401);
    });
  });

  describe("notifications lifecycle", () => {
    it("creates and retrieves notifications, then marks as read", async () => {
      const notif = await createTestNotification();
      expect(notif.readAt).toBeNull();

      const res = await markRead(
        mockRequest(`/api/notifications/${notif.id}/read`, { method: "POST" }),
        { params: Promise.resolve({ id: notif.id }) }
      );
      expect(res.status).toBe(200);

      const listRes = await GET(
        mockRequest("/api/notifications", { searchParams: { unread: "true" } })
      );
      const listData = await listRes.json();
      expect(listData.unreadCount).toBe(0);
    });
  });
});
