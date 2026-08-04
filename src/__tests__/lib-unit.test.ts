import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanupTestData, seedPermissions, createTestUser, createTestMember, createTestCommittee, createTestRole, createTestDepartment, assignCommitteeRole, assignDepartment, uniqueSuffix } from "./helpers";
import prisma from "@/lib/prisma";

describe("Permissions Library (can, canAny, getUserPermissions, requirePermission)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  describe("can()", () => {
    it("returns false for empty userId", async () => {
      const { can } = await import("@/lib/permissions");
      expect(await can("", "member.view")).toBe(false);
    });

    it("returns false for user without member profile", async () => {
      const { can } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `noprofile-${uniqueSuffix()}@test.com` });
      expect(await can(user.user.id, "member.view")).toBe(false);
    });

    it("returns false when user has no roles", async () => {
      const { can } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `noroles-${uniqueSuffix()}@test.com` });
      await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      expect(await can(user.user.id, "member.view")).toBe(false);
    });

    it("returns true when user has the permission via current committee role", async () => {
      const { can } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `hasperm-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      const committee = await createTestCommittee({ isCurrent: true });
      const role = await createTestRole({ name: `PermRole-${uniqueSuffix()}`, permissionIds: [(await prisma.permission.findUnique({ where: { key: "member.view" } }))!.id] });
      await assignCommitteeRole(member.id, role.id, committee.id);
      expect(await can(user.user.id, "member.view")).toBe(true);
    });

    it("returns false when permission is in non-current committee", async () => {
      const { can } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `oldperm-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      const oldCommittee = await createTestCommittee({ isCurrent: false });
      const role = await createTestRole({ name: `OldRole-${uniqueSuffix()}`, permissionIds: [(await prisma.permission.findUnique({ where: { key: "member.view" } }))!.id] });
      await assignCommitteeRole(member.id, role.id, oldCommittee.id);
      expect(await can(user.user.id, "member.view")).toBe(false);
    });

    it("returns false when role has ended", async () => {
      const { can } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `ended-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      const committee = await createTestCommittee({ isCurrent: true });
      const role = await createTestRole({ name: `EndedRole-${uniqueSuffix()}`, permissionIds: [(await prisma.permission.findUnique({ where: { key: "member.view" } }))!.id] });
      const cmr = await assignCommitteeRole(member.id, role.id, committee.id);
      await prisma.committeeMemberRole.update({ where: { id: cmr.id }, data: { endedAt: new Date() } });
      expect(await can(user.user.id, "member.view")).toBe(false);
    });

    it("checks department scope - member of department", async () => {
      const { can } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `deptscope-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      const committee = await createTestCommittee({ isCurrent: true });
      const dept = await createTestDepartment({ committeeId: committee.id });
      const role = await createTestRole({ name: `DeptRole-${uniqueSuffix()}`, permissionIds: [(await prisma.permission.findUnique({ where: { key: "department.manage" } }))!.id] });
      await assignCommitteeRole(member.id, role.id, committee.id);
      await assignDepartment(member.id, dept.id);
      expect(await can(user.user.id, "department.manage", { departmentId: dept.id })).toBe(true);
    });

    it("checks department scope - not member of department", async () => {
      const { can } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `noscope-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      const committee = await createTestCommittee({ isCurrent: true });
      const dept = await createTestDepartment({ committeeId: committee.id });
      const role = await createTestRole({ name: `NoDeptRole-${uniqueSuffix()}`, permissionIds: [(await prisma.permission.findUnique({ where: { key: "department.manage" } }))!.id] });
      await assignCommitteeRole(member.id, role.id, committee.id);
      expect(await can(user.user.id, "department.manage", { departmentId: dept.id })).toBe(false);
    });

    it("checks department scope - coordinator of department", async () => {
      const { can } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `coord-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      const committee = await createTestCommittee({ isCurrent: true });
      const dept = await createTestDepartment({ committeeId: committee.id, coordinatorId: member.id });
      const role = await createTestRole({ name: `CoordRole-${uniqueSuffix()}`, permissionIds: [(await prisma.permission.findUnique({ where: { key: "department.manage" } }))!.id] });
      await assignCommitteeRole(member.id, role.id, committee.id);
      expect(await can(user.user.id, "department.manage", { departmentId: dept.id })).toBe(true);
    });
  });

  describe("canAny()", () => {
    it("returns false for empty userId", async () => {
      const { canAny } = await import("@/lib/permissions");
      expect(await canAny("", ["member.view"])).toBe(false);
    });

    it("returns false for empty permission array", async () => {
      const { canAny } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `emptyarr-${uniqueSuffix()}@test.com` });
      expect(await canAny(user.user.id, [])).toBe(false);
    });

    it("returns true when user has any of the listed permissions", async () => {
      const { canAny } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `anyperm-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      const committee = await createTestCommittee({ isCurrent: true });
      const role = await createTestRole({ name: `AnyRole-${uniqueSuffix()}`, permissionIds: [(await prisma.permission.findUnique({ where: { key: "events.manage" } }))!.id] });
      await assignCommitteeRole(member.id, role.id, committee.id);
      expect(await canAny(user.user.id, ["member.view", "events.manage"])).toBe(true);
    });

    it("returns false when user has none of the listed permissions", async () => {
      const { canAny } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `noneperm-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      const committee = await createTestCommittee({ isCurrent: true });
      const role = await createTestRole({ name: `NoneRole-${uniqueSuffix()}`, permissionIds: [(await prisma.permission.findUnique({ where: { key: "events.manage" } }))!.id] });
      await assignCommitteeRole(member.id, role.id, committee.id);
      expect(await canAny(user.user.id, ["member.view", "member.create"])).toBe(false);
    });
  });

  describe("getUserPermissions()", () => {
    it("returns empty for user without member profile", async () => {
      const { getUserPermissions } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `noprofile-${uniqueSuffix()}@test.com` });
      expect(await getUserPermissions(user.user.id)).toEqual([]);
    });

    it("returns empty for empty userId", async () => {
      const { getUserPermissions } = await import("@/lib/permissions");
      expect(await getUserPermissions("")).toEqual([]);
    });

    it("returns correct permissions for user with current role", async () => {
      const { getUserPermissions } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `getperms-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      const committee = await createTestCommittee({ isCurrent: true });
      const perm = await prisma.permission.findUnique({ where: { key: "member.view" } });
      const role = await createTestRole({ name: `GetPermRole-${uniqueSuffix()}`, permissionIds: [perm!.id] });
      await assignCommitteeRole(member.id, role.id, committee.id);
      const perms = await getUserPermissions(user.user.id);
      expect(perms).toContain("member.view");
    });

    it("deduplicates permissions across multiple roles", async () => {
      const { getUserPermissions } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `dedup-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      const committee = await createTestCommittee({ isCurrent: true });
      const perm = await prisma.permission.findUnique({ where: { key: "member.view" } });
      const role1 = await createTestRole({ name: `Dedup1-${uniqueSuffix()}`, permissionIds: [perm!.id] });
      const role2 = await createTestRole({ name: `Dedup2-${uniqueSuffix()}`, permissionIds: [perm!.id] });
      await assignCommitteeRole(member.id, role1.id, committee.id);
      await assignCommitteeRole(member.id, role2.id, committee.id);
      const perms = await getUserPermissions(user.user.id);
      const viewCount = perms.filter(p => p === "member.view").length;
      expect(viewCount).toBe(1);
    });

    it("excludes permissions from ended roles", async () => {
      const { getUserPermissions } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `endedget-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      const committee = await createTestCommittee({ isCurrent: true });
      const perm = await prisma.permission.findUnique({ where: { key: "member.view" } });
      const role = await createTestRole({ name: `EndedGetRole-${uniqueSuffix()}`, permissionIds: [perm!.id] });
      const cmr = await assignCommitteeRole(member.id, role.id, committee.id);
      await prisma.committeeMemberRole.update({ where: { id: cmr.id }, data: { endedAt: new Date() } });
      const perms = await getUserPermissions(user.user.id);
      expect(perms).not.toContain("member.view");
    });
  });

  describe("requirePermission()", () => {
    it("throws for user without permission", async () => {
      const { requirePermission } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `reqperm-${uniqueSuffix()}@test.com` });
      await expect(requirePermission(user.user.id, "member.view")).rejects.toThrow("Permission denied");
    });

    it("does not throw for user with permission", async () => {
      const { requirePermission } = await import("@/lib/permissions");
      const user = await createTestUser({ email: `reqok-${uniqueSuffix()}@test.com` });
      const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
      const committee = await createTestCommittee({ isCurrent: true });
      const role = await createTestRole({ name: `ReqRole-${uniqueSuffix()}`, permissionIds: [(await prisma.permission.findUnique({ where: { key: "member.view" } }))!.id] });
      await assignCommitteeRole(member.id, role.id, committee.id);
      await expect(requirePermission(user.user.id, "member.view")).resolves.toBeUndefined();
    });
  });

  describe("PERMISSIONS constant", () => {
    it("contains all 16 permission keys", async () => {
      const { PERMISSIONS } = await import("@/lib/permissions");
      expect(PERMISSIONS).toHaveLength(16);
    });

    it("includes required permission keys", async () => {
      const { PERMISSIONS } = await import("@/lib/permissions");
      const required = ["member.view", "member.create", "member.edit", "department.view", "department.manage", "committee.manage", "registration.manage", "registration.review", "promotion.submit", "promotion.approve", "gallery.upload", "gallery.manage", "updates.publish", "events.manage", "permissions.manage", "settings.manage"];
      for (const key of required) {
        expect(PERMISSIONS).toContain(key);
      }
    });
  });
});

describe("API Helpers (getPaginationParams)", () => {
  it("extracts default pagination params", async () => {
    const { getPaginationParams } = await import("@/lib/api-helpers");
    const { mockRequest } = await import("./helpers");
    const request = mockRequest("/api/test");
    const result = getPaginationParams(request);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.skip).toBe(0);
  });

  it("extracts custom pagination params", async () => {
    const { getPaginationParams } = await import("@/lib/api-helpers");
    const { mockRequest } = await import("./helpers");
    const request = mockRequest("/api/test", { searchParams: { page: "3", limit: "10" } });
    const result = getPaginationParams(request);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
    expect(result.skip).toBe(20);
  });

  it("caps limit at 100", async () => {
    const { getPaginationParams } = await import("@/lib/api-helpers");
    const { mockRequest } = await import("./helpers");
    const request = mockRequest("/api/test", { searchParams: { limit: "500" } });
    const result = getPaginationParams(request);
    expect(result.limit).toBe(100);
  });

  it("floors page at 1", async () => {
    const { getPaginationParams } = await import("@/lib/api-helpers");
    const { mockRequest } = await import("./helpers");
    const request = mockRequest("/api/test", { searchParams: { page: "0" } });
    const result = getPaginationParams(request);
    expect(result.page).toBe(1);
  });

  it("handles invalid page/limit values", async () => {
    const { getPaginationParams } = await import("@/lib/api-helpers");
    const { mockRequest } = await import("./helpers");
    const request = mockRequest("/api/test", { searchParams: { page: "abc", limit: "xyz" } });
    const result = getPaginationParams(request);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});

describe("Email Library", () => {
  describe("applicantStatusEmail()", () => {
    it("returns subject and html (mocked in setup)", async () => {
      const { applicantStatusEmail } = await import("@/lib/email");
      const result = applicantStatusEmail("John Doe", "accepted", "Spring Recruitment");
      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("html");
      expect(typeof result.subject).toBe("string");
      expect(typeof result.html).toBe("string");
    });
  });

  describe("sendEmail()", () => {
    it("is mocked and returns mock result", async () => {
      const { sendEmail } = await import("@/lib/email");
      const result = await sendEmail({ to: "test@test.com", subject: "Test", html: "<p>Hi</p>" });
      expect(result).toBeDefined();
    });
  });
});

describe("Audit Library", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("logAudit()", () => {
    it("creates audit log entry", async () => {
      const { logAudit } = await import("@/lib/audit");
      await logAudit({ actorId: "test-actor", action: "test.action", entityType: "Test", entityId: "test-123" });
      const log = await prisma.auditLog.findFirst({ where: { actorId: "test-actor" } });
      expect(log).not.toBeNull();
      expect(log!.action).toBe("test.action");
      expect(log!.entityType).toBe("Test");
      expect(log!.entityId).toBe("test-123");
    });

    it("stores metadata correctly", async () => {
      const { logAudit } = await import("@/lib/audit");
      await logAudit({ actorId: "meta-actor", action: "test.meta", entityType: "Test", entityId: "meta-1", metadata: { key: "value", count: 42 } });
      const log = await prisma.auditLog.findFirst({ where: { actorId: "meta-actor" } });
      expect(log).not.toBeNull();
      expect(log!.metadata).toBeDefined();
    });

    it("does not throw on failure", async () => {
      const { logAudit } = await import("@/lib/audit");
      await expect(logAudit({ actorId: "", action: "", entityType: "", entityId: "" })).resolves.toBeUndefined();
    });

    it("swallows DB write errors and logs them", async () => {
      const { logAudit } = await import("@/lib/audit");
      const createSpy = vi
        .spyOn(prisma.auditLog, "create")
        .mockRejectedValueOnce(new Error("db down"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(
        logAudit({ actorId: "x", action: "a", entityType: "T", entityId: "1" })
      ).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      createSpy.mockRestore();
    });
  });
});

describe("R2 Library", () => {
  describe("buildR2Key()", () => {
    it("builds a key with folder and filename", async () => {
      const { buildR2Key } = await import("@/lib/r2");
      const key = buildR2Key("gallery", "photo.jpg");
      expect(key).toMatch(/^gallery\/\d+_photo\.jpg$/);
    });

    it("builds a key with departmentId", async () => {
      const { buildR2Key } = await import("@/lib/r2");
      const key = buildR2Key("gallery", "photo.jpg", "dept123");
      expect(key).toMatch(/^gallery\/dept123\/\d+_photo\.jpg$/);
    });

    it("sanitizes directory traversal in filename", async () => {
      const { buildR2Key } = await import("@/lib/r2");
      const key = buildR2Key("gallery", "../../etc/passwd.jpg");
      expect(key).not.toContain("..");
      expect(key).toContain("passwd");
    });

    it("sanitizes special characters in folder name", async () => {
      const { buildR2Key } = await import("@/lib/r2");
      const key = buildR2Key("my gallery", "photo.jpg");
      expect(key).toMatch(/^my_gallery\//);
    });

    it("sanitizes special characters in departmentId", async () => {
      const { buildR2Key } = await import("@/lib/r2");
      const key = buildR2Key("gallery", "photo.jpg", "dept/../../etc");
      expect(key).not.toContain("..");
    });
  });

  describe("isValidUploadType()", () => {
    it("accepts valid image types", async () => {
      const { isValidUploadType } = await import("@/lib/r2");
      expect(isValidUploadType("image/jpeg")).toBe(true);
      expect(isValidUploadType("image/png")).toBe(true);
      expect(isValidUploadType("image/gif")).toBe(true);
      expect(isValidUploadType("image/webp")).toBe(true);
    });

    it("accepts valid video types", async () => {
      const { isValidUploadType } = await import("@/lib/r2");
      expect(isValidUploadType("video/mp4")).toBe(true);
      expect(isValidUploadType("video/webm")).toBe(true);
    });

    it("rejects invalid types", async () => {
      const { isValidUploadType } = await import("@/lib/r2");
      expect(isValidUploadType("text/plain")).toBe(false);
      expect(isValidUploadType("application/pdf")).toBe(false);
      expect(isValidUploadType("image/svg+xml")).toBe(false);
      expect(isValidUploadType("")).toBe(false);
    });
  });

  describe("ALLOWED_UPLOAD_TYPES", () => {
    it("contains 6 allowed types", async () => {
      const { ALLOWED_UPLOAD_TYPES } = await import("@/lib/r2");
      expect(ALLOWED_UPLOAD_TYPES).toHaveLength(6);
    });
  });
});

describe("Notifications Library", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  describe("createNotification()", () => {
    it("is mocked and does not throw", async () => {
      const { createNotification } = await import("@/lib/notifications");
      const user = await createTestUser({ email: `notif-${uniqueSuffix()}@test.com` });
      await expect(createNotification({
        userId: user.user.id,
        type: "GENERAL",
        title: "Test Notif",
        message: "Hello",
      })).resolves.toBeUndefined();
    });

    it("accepts payload and link params", async () => {
      const { createNotification } = await import("@/lib/notifications");
      const user = await createTestUser({ email: `notif2-${uniqueSuffix()}@test.com` });
      await expect(createNotification({
        userId: user.user.id,
        type: "EVENT",
        title: "Event Notif",
        message: "Event happened",
        payload: { eventId: "123" },
        link: "/events/123",
      })).resolves.toBeUndefined();
    });

    it("does not throw on invalid userId", async () => {
      const { createNotification } = await import("@/lib/notifications");
      await expect(createNotification({
        userId: "nonexistent",
        type: "GENERAL",
        title: "Test",
        message: "Test",
      })).resolves.toBeUndefined();
    });
  });

  describe("notifyDepartmentMembers()", () => {
    it("is mocked and does not throw", async () => {
      const { notifyDepartmentMembers } = await import("@/lib/notifications");
      const committee = await createTestCommittee({ isCurrent: true });
      const dept = await createTestDepartment({ committeeId: committee.id });
      await expect(notifyDepartmentMembers({
        departmentId: dept.id,
        type: "EVENT",
        title: "Dept Event",
        message: "Event in dept",
      })).resolves.toBeUndefined();
    });

    it("does nothing for empty department", async () => {
      const { notifyDepartmentMembers } = await import("@/lib/notifications");
      await expect(notifyDepartmentMembers({
        departmentId: "nonexistent",
        type: "EVENT",
        title: "Empty",
        message: "Empty dept",
      })).resolves.toBeUndefined();
    });
  });

  describe("notifyAllActiveMembers()", () => {
    it("is mocked and does not throw", async () => {
      const { notifyAllActiveMembers } = await import("@/lib/notifications");
      await expect(notifyAllActiveMembers({
        type: "ANNOUNCEMENT",
        title: "Global Notif",
        message: "Global announcement",
      })).resolves.toBeUndefined();
    });
  });
});

describe("Notifications Library — REAL implementations (bypass setup mocks)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  it("createNotification actually writes a DB row", async () => {
    const real = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
    const { createNotification } = await import("@/lib/notifications");
    vi.mocked(createNotification).mockImplementation(real.createNotification);

    const user = await createTestUser({ email: `realnotif-${uniqueSuffix()}@test.com` });
    await createNotification({
      userId: user.user.id,
      type: "EVENT",
      title: "Real Notification",
      message: "Written to DB",
      payload: { eventId: "evt-1" },
      link: "/events/evt-1",
    });

    const n = await prisma.notification.findFirst({ where: { userId: user.user.id } });
    expect(n).not.toBeNull();
    expect(n!.title).toBe("Real Notification");
    expect(n!.type).toBe("EVENT");
    expect(n!.readAt).toBeNull();
  });

  it("notifyDepartmentMembers notifies department members + coordinator", async () => {
    const real = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
    const { notifyDepartmentMembers } = await import("@/lib/notifications");
    vi.mocked(notifyDepartmentMembers).mockImplementation(real.notifyDepartmentMembers);

    const memberUser = await createTestUser({ email: `deptm-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: memberUser.user.id, status: "ACTIVE" });
    const coordUser = await createTestUser({ email: `coordm-${uniqueSuffix()}@test.com` });
    const coordMember = await createTestMember({ userId: coordUser.user.id, status: "ACTIVE" });
    const outsiderUser = await createTestUser({ email: `outsider-${uniqueSuffix()}@test.com` });
    await createTestMember({ userId: outsiderUser.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const dept = await createTestDepartment({ committeeId: committee.id, coordinatorId: coordMember.id });
    await assignDepartment(member.id, dept.id);

    await notifyDepartmentMembers({
      departmentId: dept.id,
      type: "EVENT",
      title: "Dept Event",
      message: "Your department has a new event",
    });

    const memberNotif = await prisma.notification.findFirst({ where: { userId: memberUser.user.id } });
    const coordNotif = await prisma.notification.findFirst({ where: { userId: coordUser.user.id } });
    const outsiderNotif = await prisma.notification.findFirst({ where: { userId: outsiderUser.user.id } });
    expect(memberNotif).not.toBeNull();
    expect(coordNotif).not.toBeNull();
    expect(outsiderNotif).toBeNull();
  });

  it("notifyDepartmentMembers respects excludeUserId", async () => {
    const real = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
    const { notifyDepartmentMembers } = await import("@/lib/notifications");
    vi.mocked(notifyDepartmentMembers).mockImplementation(real.notifyDepartmentMembers);

    const memberUser = await createTestUser({ email: `exclm-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: memberUser.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const dept = await createTestDepartment({ committeeId: committee.id });
    await assignDepartment(member.id, dept.id);

    await notifyDepartmentMembers({
      departmentId: dept.id,
      type: "EVENT",
      title: "Excluded",
      message: "Should not reach this member",
      excludeUserId: memberUser.user.id,
    });

    const notif = await prisma.notification.findFirst({ where: { userId: memberUser.user.id } });
    expect(notif).toBeNull();
  });

  it("notifyAllActiveMembers notifies only ACTIVE members", async () => {
    const real = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
    const { notifyAllActiveMembers } = await import("@/lib/notifications");
    vi.mocked(notifyAllActiveMembers).mockImplementation(real.notifyAllActiveMembers);

    const activeUser = await createTestUser({ email: `actm-${uniqueSuffix()}@test.com` });
    await createTestMember({ userId: activeUser.user.id, status: "ACTIVE" });
    const alumniUser = await createTestUser({ email: `alumnim-${uniqueSuffix()}@test.com` });
    await createTestMember({ userId: alumniUser.user.id, status: "ALUMNI" });
    const pendingUser = await createTestUser({ email: `pendingm-${uniqueSuffix()}@test.com` });
    await createTestMember({ userId: pendingUser.user.id, status: "PENDING" });
    const noProfileUser = await createTestUser({ email: `noprofm-${uniqueSuffix()}@test.com` });

    await notifyAllActiveMembers({
      type: "ANNOUNCEMENT",
      title: "Club Announcement",
      message: "Important news",
    });

    expect(await prisma.notification.findFirst({ where: { userId: activeUser.user.id } })).not.toBeNull();
    expect(await prisma.notification.findFirst({ where: { userId: alumniUser.user.id } })).toBeNull();
    expect(await prisma.notification.findFirst({ where: { userId: pendingUser.user.id } })).toBeNull();
    expect(await prisma.notification.findFirst({ where: { userId: noProfileUser.user.id } })).toBeNull();
  });

  it("notifyAllActiveMembers excludes the specified user", async () => {
    const real = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
    const { notifyAllActiveMembers } = await import("@/lib/notifications");
    vi.mocked(notifyAllActiveMembers).mockImplementation(real.notifyAllActiveMembers);

    const activeUser = await createTestUser({ email: `exclall-${uniqueSuffix()}@test.com` });
    await createTestMember({ userId: activeUser.user.id, status: "ACTIVE" });

    await notifyAllActiveMembers({
      type: "ANNOUNCEMENT",
      title: "Skip me",
      message: "Should skip",
      excludeUserId: activeUser.user.id,
    });

    expect(await prisma.notification.findFirst({ where: { userId: activeUser.user.id } })).toBeNull();
  });
});

describe("Email Library — REAL implementations (bypass setup mocks)", () => {
  beforeEach(() => {
    // Force-unset so the tests are deterministic regardless of the developer's .env
    vi.stubEnv("RESEND_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("applicantStatusEmail escapes HTML in name and window title", async () => {
    const real = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
    const { applicantStatusEmail } = await import("@/lib/email");
    vi.mocked(applicantStatusEmail).mockImplementation(real.applicantStatusEmail);

    const result = applicantStatusEmail("<script>alert(1)</script>", "accepted", "Spring <b>Recruitment</b>");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;b&gt;");
  });

  it("applicantStatusEmail sanitizes subject (strips newlines)", async () => {
    const real = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
    const { applicantStatusEmail } = await import("@/lib/email");
    vi.mocked(applicantStatusEmail).mockImplementation(real.applicantStatusEmail);

    const result = applicantStatusEmail("John", "rejected", "Recruitment\r\nBcc: evil@x.com");
    expect(result.subject).not.toContain("\r");
    expect(result.subject).not.toContain("\n");
    expect(result.html).toContain("not accepted");
  });

  it("sendEmail returns false when Resend is not configured", async () => {
    const real = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
    const { sendEmail } = await import("@/lib/email");
    vi.mocked(sendEmail).mockImplementation(real.sendEmail);

    // Test env has no RESEND_API_KEY, so the client is null and email is skipped
    const result = await sendEmail({ to: "test@test.com", subject: "Test", html: "<p>Hi</p>" });
    expect(result).toBe(false);
  });
});

describe("R2 Library — unconfigured error paths", () => {
  beforeEach(() => {
    // Force-unset R2 config so these tests are deterministic regardless of .env
    vi.stubEnv("R2_ACCOUNT_ID", "");
    vi.stubEnv("R2_ACCESS_KEY_ID", "");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
    vi.stubEnv("R2_BUCKET_NAME", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("getPublicUrl throws when R2 is not configured", async () => {
    const { getPublicUrl } = await import("@/lib/r2");
    expect(() => getPublicUrl("gallery/x.jpg")).toThrow("Missing R2 configuration");
  });

  it("getPresignedUploadUrl throws when R2 is not configured", async () => {
    const { getPresignedUploadUrl } = await import("@/lib/r2");
    await expect(getPresignedUploadUrl("gallery/x.jpg", "image/jpeg")).rejects.toThrow("Missing R2 configuration");
  });
});

describe("Email Library — configured send branches (injectable client)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sendEmail returns true when the injected client sends successfully", async () => {
    const real = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
    const email = await import("@/lib/email");
    vi.mocked(email.sendEmail).mockImplementation(real.sendEmail);
    vi.mocked(email._setResendForTesting).mockImplementation(real._setResendForTesting);

    const send = vi.fn().mockResolvedValue({ id: "1" });
    email._setResendForTesting({ emails: { send } } as never);
    const result = await email.sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(result).toBe(true);
    expect(send).toHaveBeenCalled();
    email._setResendForTesting(undefined);
  });

  it("sendEmail returns false when the injected client throws", async () => {
    const real = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
    const email = await import("@/lib/email");
    vi.mocked(email.sendEmail).mockImplementation(real.sendEmail);
    vi.mocked(email._setResendForTesting).mockImplementation(real._setResendForTesting);

    email._setResendForTesting({ emails: { send: vi.fn().mockRejectedValue(new Error("boom")) } } as never);
    const result = await email.sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(result).toBe(false);
    email._setResendForTesting(undefined);
  });

  it("sendEmail returns false when client is injected as null (not configured)", async () => {
    const real = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
    const email = await import("@/lib/email");
    vi.mocked(email.sendEmail).mockImplementation(real.sendEmail);
    vi.mocked(email._setResendForTesting).mockImplementation(real._setResendForTesting);

    email._setResendForTesting(null);
    const result = await email.sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(result).toBe(false);
    email._setResendForTesting(undefined);
  });

  it("applicantStatusEmail builds accepted and rejected messages", async () => {
    const real = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
    const { applicantStatusEmail } = await import("@/lib/email");
    vi.mocked(applicantStatusEmail).mockImplementation(real.applicantStatusEmail);

    const acc = applicantStatusEmail("Jane", "accepted", "Recruit");
    expect(acc.subject).toContain("Accepted");
    expect(acc.html).toContain("accepted");

    const rej = applicantStatusEmail("Jane", "rejected", "Recruit");
    expect(rej.subject).toContain("Update");
    expect(rej.html).toContain("not accepted");
  });
});

// R2 is not mocked in setup.ts, so we can vi.doMock the AWS SDK + set env vars
// and re-import the module fresh to exercise its configured branches.
describe("R2 Library — configured branches (mocked AWS SDK)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function importConfiguredR2() {
    vi.resetModules();
    vi.doMock("@aws-sdk/s3-request-presigner", () => ({
      getSignedUrl: vi.fn(async () => "https://signed.example/ok"),
    }));
    vi.doMock("@aws-sdk/client-s3", () => ({
      S3Client: class {
        constructor(public cfg: unknown) {}
        async send() {
          return {};
        }
      },
      PutObjectCommand: class {
        constructor(public input: unknown) {}
      },
      GetObjectCommand: class {
        constructor(public input: unknown) {}
      },
    }));
    vi.stubEnv("R2_ACCOUNT_ID", "acct");
    vi.stubEnv("R2_ACCESS_KEY_ID", "key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
    vi.stubEnv("R2_BUCKET_NAME", "bucket");
    vi.stubEnv("R2_PUBLIC_URL", "https://cdn.example");
    return import("@/lib/r2");
  }

  it("getPresignedUploadUrl returns a signed URL + public URL when configured", async () => {
    const r2 = await importConfiguredR2();
    const { uploadUrl, publicUrl } = await r2.getPresignedUploadUrl("gallery/x.jpg", "image/jpeg");
    expect(uploadUrl).toBe("https://signed.example/ok");
    expect(publicUrl).toBe("https://cdn.example/gallery/x.jpg");
  });

  it("getPresignedDownloadUrl returns a signed URL when configured", async () => {
    const r2 = await importConfiguredR2();
    const url = await r2.getPresignedDownloadUrl("gallery/x.jpg");
    expect(url).toBe("https://signed.example/ok");
  });

  it("getPublicUrl builds the CDN URL when configured", async () => {
    const r2 = await importConfiguredR2();
    expect(r2.getPublicUrl("gallery/x.jpg")).toBe("https://cdn.example/gallery/x.jpg");
  });

  it("isValidUploadType accepts allowed and rejects disallowed types", async () => {
    const r2 = await importConfiguredR2();
    expect(r2.isValidUploadType("image/png")).toBe(true);
    expect(r2.isValidUploadType("video/mp4")).toBe(true);
    expect(r2.isValidUploadType("application/pdf")).toBe(false);
    expect(r2.ALLOWED_UPLOAD_TYPES.length).toBeGreaterThan(0);
  });

  it("buildR2Key sanitizes folder, filename, and department id", async () => {
    const r2 = await importConfiguredR2();
    const key = r2.buildR2Key("gal lery", "../evil.jpg", "dept/../x");
    expect(key).not.toContain(" ");
    expect(key).not.toContain("..");
    expect(key).not.toContain("/evil");
    expect(key).toMatch(/\.jpg$/);
  });

  it("buildR2Key includes department prefix when provided", async () => {
    const r2 = await importConfiguredR2();
    const key = r2.buildR2Key("gallery", "photo.png", "dept-123");
    expect(key).toContain("gallery/dept-123/");
  });
});
