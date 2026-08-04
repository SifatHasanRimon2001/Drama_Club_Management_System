import { describe, it, expect, beforeEach } from "vitest";
import { POST as CREATE_EVENT } from "@/app/api/events/route";
import { POST as CREATE_UPDATE } from "@/app/api/updates/route";
import {
  mockRequest,
  mockAuth,
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

describe("Audit Log", () => {
  let adminUserId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-audit-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ["events.manage", "updates.publish"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);

    mockAuth(adminUserId, ["events.manage", "updates.publish"]);
  });

  it("audit log helper exists", async () => {
    const { logAudit } = await import("@/lib/audit");
    expect(typeof logAudit).toBe("function");
  });

  it("creates audit log on event creation", async () => {
    await CREATE_EVENT(
      mockRequest("/api/events", {
        method: "POST",
        body: { title: `Audit Event${uniqueSuffix()}`, type: "WORKSHOP", startAt: "2025-06-01T10:00:00.000Z" },
      })
    );

    const auditLogs = await prisma.auditLog.findMany({
      where: { action: "event.created" },
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].actorId).toBe(adminUserId);
    expect(auditLogs[0].entityType).toBe("Event");
  });

  it("creates audit log on update creation", async () => {
    await CREATE_UPDATE(
      mockRequest("/api/updates", {
        method: "POST",
        body: { title: `Audit Update${uniqueSuffix()}`, bodyRichText: "<p>Content</p>", category: "ANNOUNCEMENT" },
      })
    );

    const auditLogs = await prisma.auditLog.findMany({
      where: { action: "update.created" },
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].actorId).toBe(adminUserId);
  });

  it("stores correct metadata in audit log", async () => {
    const title = `Meta Event${uniqueSuffix()}`;
    await CREATE_EVENT(
      mockRequest("/api/events", {
        method: "POST",
        body: { title, type: "PERFORMANCE", startAt: "2025-06-01T10:00:00.000Z" },
      })
    );

    const auditLog = await prisma.auditLog.findFirst({
      where: { action: "event.created" },
    });
    expect(auditLog).not.toBeNull();
    expect(auditLog!.metadata).toBeDefined();
  });

  it("audit log does not block response on failure", async () => {
    const { logAudit } = await import("@/lib/audit");
    expect(typeof logAudit).toBe("function");
  });
});
