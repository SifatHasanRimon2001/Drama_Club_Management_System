import { describe, it, expect, beforeEach } from "vitest";
import { GET as AUDIT_GET } from "@/app/api/audit-log/route";
import { POST as CREATE_UPDATE } from "@/app/api/updates/route";
import { GET as ABOUT_GET } from "@/app/api/public/about/route";
import { sanitizeRichText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";
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

describe("Audit Log Viewer", () => {
  let adminUserId: string;
  let actorUserId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `auditview-admin-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const adminMember = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ["permissions.manage", "updates.publish"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(adminMember.id, adminRole.id, committee.id);

    const actor = await createTestUser({ email: `auditview-actor-${uniqueSuffix()}@test.com`, name: "Actor Person" });
    actorUserId = actor.user.id;
    await createTestMember({ userId: actorUserId, status: "ACTIVE" });

    mockAuth(adminUserId, ["permissions.manage", "updates.publish"]);
  });

  it("returns 401 when unauthenticated", async () => {
    clearAuth();
    const res = await AUDIT_GET(mockRequest("/api/audit-log"));
    expect(res.status).toBe(401);
  });

  it("returns 403 without permissions.manage", async () => {
    const outsider = await createTestUser({ email: `auditview-out-${uniqueSuffix()}@test.com` });
    mockAuth(outsider.user.id, []);
    const res = await AUDIT_GET(mockRequest("/api/audit-log"));
    expect(res.status).toBe(403);
  });

  it("lists entries with resolved actor names", async () => {
    await logAudit({
      actorId: actorUserId,
      action: "member.updated",
      entityType: "Member",
      entityId: "mem_1",
      metadata: { changes: ["status"] },
    });
    await logAudit({
      actorId: "public",
      action: "contact.submitted",
      entityType: "ContactSubmission",
      entityId: "sub_1",
    });

    const res = await AUDIT_GET(mockRequest("/api/audit-log"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entries.length).toBe(2);
    expect(data.pagination.total).toBe(2);

    const memberEntry = data.entries.find((e: { action: string }) => e.action === "member.updated");
    expect(memberEntry.actorName).toBe("Actor Person");
    expect(memberEntry.metadata.changes).toEqual(["status"]);

    const contactEntry = data.entries.find((e: { action: string }) => e.action === "contact.submitted");
    expect(contactEntry.actorName).toBe("Public");
  });

  it("filters by action and entityType and reports filter options", async () => {
    await logAudit({ actorId: actorUserId, action: "role.updated", entityType: "Role", entityId: "r1" });
    await logAudit({ actorId: actorUserId, action: "promotion.approved", entityType: "PromotionRequest", entityId: "p1" });

    const res = await AUDIT_GET(mockRequest("/api/audit-log", { searchParams: { action: "role.updated" } }));
    const data = await res.json();
    expect(data.entries.length).toBe(1);
    expect(data.entries[0].action).toBe("role.updated");

    const res2 = await AUDIT_GET(mockRequest("/api/audit-log", { searchParams: { entityType: "PromotionRequest" } }));
    const data2 = await res2.json();
    expect(data2.entries.length).toBe(1);
    expect(data2.entries[0].entityType).toBe("PromotionRequest");

    expect(data.filters.actions).toContain("promotion.approved");
    expect(data.filters.entityTypes).toContain("Role");
  });

  it("paginates", async () => {
    for (let i = 0; i < 30; i++) {
      await logAudit({ actorId: actorUserId, action: "test.created", entityType: "Member", entityId: `m${i}` });
    }
    const res = await AUDIT_GET(mockRequest("/api/audit-log", { searchParams: { limit: "25" } }));
    const data = await res.json();
    expect(data.entries.length).toBe(25);
    expect(data.pagination.totalPages).toBe(2);
  });
});

describe("Rich text sanitizer", () => {
  it("strips scripts and event handlers", () => {
    const out = sanitizeRichText(
      '<p>Hello</p><script>alert(1)</script><img src="x" onerror="alert(1)"><p onclick="alert(1)">Hi</p>'
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("onclick");
    expect(out).toContain("<p>Hello</p>");
  });

  it("blocks javascript: URLs", () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">bad</a><a href="https://example.com">ok</a>');
    expect(out).not.toContain("javascript:");
    expect(out).toContain("https://example.com");
  });

  it("forces noopener on links and keeps text-align styles only", () => {
    const out = sanitizeRichText(
      '<a href="https://x.com" target="_blank">x</a><p style="text-align: center; color: red; position: absolute;">p</p>'
    );
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain("text-align:center");
    expect(out).not.toContain("color:");
    expect(out).not.toContain("position:");
  });

  it("persists sanitized HTML through the updates API", async () => {
    await seedPermissions();
    const admin = await createTestUser({ email: `sanitize-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: admin.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const role = await createTestRole({
      name: "Editor",
      permissionIds: (
        await Promise.all(
          ["updates.publish"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, role.id, committee.id);
    mockAuth(admin.user.id, ["updates.publish"]);

    const res = await CREATE_UPDATE(
      mockRequest("/api/updates", {
        method: "POST",
        body: {
          title: `Sanitize Test ${uniqueSuffix()}`,
          bodyRichText: '<p>Safe</p><script>alert(1)</script><img src="x" onerror="alert(2)">',
          category: "ANNOUNCEMENT",
        },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.bodyRichText).not.toContain("<script");
    expect(data.bodyRichText).not.toContain("onerror");
    expect(data.bodyRichText).toContain("<p>Safe</p>");
  });
});

describe("Public about maintenance flags", () => {
  it("defaults to registration enabled and no maintenance", async () => {
    const res = await ABOUT_GET();
    const data = await res.json();
    expect(data.registrationEnabled).toBe(true);
    expect(data.maintenanceMode).toBe(false);
  });

  it("reflects stored settings", async () => {
    await prisma.systemSetting.createMany({
      data: [
        { key: "registrationEnabled", value: false },
        { key: "maintenanceMode", value: true },
      ],
    });
    const res = await ABOUT_GET();
    const data = await res.json();
    expect(data.registrationEnabled).toBe(false);
    expect(data.maintenanceMode).toBe(true);
  });
});
