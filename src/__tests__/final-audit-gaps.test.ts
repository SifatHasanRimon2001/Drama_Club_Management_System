import { describe, it, expect, beforeEach, vi } from "vitest";
import { PATCH as ROLE_PATCH, DELETE as ROLE_DELETE } from "@/app/api/roles/[id]/route";
import { GET as TASKS_GET } from "@/app/api/departments/[id]/tasks/route";
import { POST as EVENTS_POST } from "@/app/api/events/route";
import { notifyDepartmentMembers, notifyAllActiveMembers } from "@/lib/notifications";
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
  assignDepartment,
  getTestPermission,
  uniqueSuffix,
} from "./helpers";
import prisma from "@/lib/prisma";

async function setupUser(permissions: string[]) {
  const user = await createTestUser({ email: `setup-${uniqueSuffix()}@test.com` });
  const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
  const committee = await createTestCommittee({ isCurrent: true });
  if (permissions.length > 0) {
    const permIds = (
      await prisma.permission.findMany({ where: { key: { in: permissions } } })
    ).map((p) => p.id);
    const role = await createTestRole({ name: `Setup-${uniqueSuffix()}`, permissionIds: permIds });
    await assignCommitteeRole(member.id, role.id, committee.id);
  }
  mockAuth(user.user.id, permissions);
  return { user: user.user, member, committee };
}

describe("Role PATCH — rename collision handling", () => {
  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    await seedPermissions();
  });

  it("renaming a role to an existing role's name returns 409", async () => {
    await setupUser(["permissions.manage"]);
    const existing = await prisma.role.create({ data: { name: `Existing-${uniqueSuffix()}` } });
    const target = await prisma.role.create({ data: { name: `Target-${uniqueSuffix()}` } });

    const res = await ROLE_PATCH(
      mockRequest(`/api/roles/${target.id}`, { method: "PATCH", body: { name: existing.name } }),
      { params: Promise.resolve({ id: target.id }) }
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("A role with this name already exists");
  });

  it("renaming a role to its own name still succeeds", async () => {
    await setupUser(["permissions.manage"]);
    const target = await prisma.role.create({ data: { name: `Solo-${uniqueSuffix()}` } });

    const res = await ROLE_PATCH(
      mockRequest(`/api/roles/${target.id}`, { method: "PATCH", body: { name: target.name } }),
      { params: Promise.resolve({ id: target.id }) }
    );
    expect(res.status).toBe(200);
  });
});

describe("Role DELETE — active assignment guard", () => {
  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    await seedPermissions();
  });

  it("refuses to delete a role actively assigned to a committee member (400)", async () => {
    const { committee } = await setupUser(["permissions.manage"]);
    const inUseRole = await prisma.role.create({ data: { name: `InUse-${uniqueSuffix()}` } });
    const otherUser = await createTestUser({ email: `holder-${uniqueSuffix()}@test.com` });
    const otherMember = await createTestMember({ userId: otherUser.user.id, status: "ACTIVE" });
    await assignCommitteeRole(otherMember.id, inUseRole.id, committee.id);

    const res = await ROLE_DELETE(
      mockRequest(`/api/roles/${inUseRole.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: inUseRole.id }) }
    );
    expect(res.status).toBe(400);

    const stillThere = await prisma.role.findUnique({ where: { id: inUseRole.id } });
    expect(stillThere).not.toBeNull();
  });

  it("deletes the role once all assignments are removed", async () => {
    const { member, committee } = await setupUser(["permissions.manage"]);
    const freeRole = await prisma.role.create({ data: { name: `Free-${uniqueSuffix()}` } });
    await assignCommitteeRole(member.id, freeRole.id, committee.id);

    await prisma.committeeMemberRole.deleteMany({ where: { roleId: freeRole.id } });

    const res = await ROLE_DELETE(
      mockRequest(`/api/roles/${freeRole.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: freeRole.id }) }
    );
    expect(res.status).toBe(200);

    const gone = await prisma.role.findUnique({ where: { id: freeRole.id } });
    expect(gone).toBeNull();
  });
});

describe("§5 — tasks GET: department.manage OR department member/coordinator", () => {
  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    await seedPermissions();
  });

  it("allows a department member with no permissions at all to list tasks", async () => {
    const { member, committee } = await setupUser([]);
    const dept = await createTestDepartment({ committeeId: committee.id });
    await assignDepartment(member.id, dept.id);
    const task = await prisma.task.create({ data: { departmentId: dept.id, title: `MemberTask-${uniqueSuffix()}` } });

    const res = await TASKS_GET(
      mockRequest(`/api/departments/${dept.id}/tasks`),
      { params: Promise.resolve({ id: dept.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.map((t: { id: string }) => t.id)).toContain(task.id);
  });

  it("allows a department coordinator with no permissions at all to list tasks", async () => {
    const { member, committee } = await setupUser([]);
    const dept = await createTestDepartment({ committeeId: committee.id, coordinatorId: member.id });
    await prisma.task.create({ data: { departmentId: dept.id, title: `CoordTask-${uniqueSuffix()}` } });

    const res = await TASKS_GET(
      mockRequest(`/api/departments/${dept.id}/tasks`),
      { params: Promise.resolve({ id: dept.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(1);
  });

  it("denies a non-member holding only department.view (403)", async () => {
    const committee = await createTestCommittee({ isCurrent: true });
    const dept = await createTestDepartment({ committeeId: committee.id });
    const user = await createTestUser({ email: `outsider-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
    const viewPerm = await getTestPermission("department.view");
    const role = await createTestRole({ name: `View-${uniqueSuffix()}`, permissionIds: [viewPerm!.id] });
    await assignCommitteeRole(member.id, role.id, committee.id);
    mockAuth(user.user.id, ["department.view"]);

    const res = await TASKS_GET(
      mockRequest(`/api/departments/${dept.id}/tasks`),
      { params: Promise.resolve({ id: dept.id }) }
    );
    expect(res.status).toBe(403);
  });
});

describe("Events POST — notification failures do not fail creation", () => {
  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    await seedPermissions();
  });

  it("creates the event (201) when department-member notification fails", async () => {
    const { committee } = await setupUser(["events.manage"]);
    const dept = await createTestDepartment({ committeeId: committee.id });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(notifyDepartmentMembers).mockRejectedValueOnce(new Error("boom"));

    const title = `NotifyFail-${uniqueSuffix()}`;
    const res = await EVENTS_POST(
      mockRequest("/api/events", {
        method: "POST",
        body: {
          title,
          type: "WORKSHOP",
          departmentId: dept.id,
          startAt: "2026-01-01T00:00:00.000Z",
        },
      })
    );
    expect(res.status).toBe(201);
    expect(consoleSpy).toHaveBeenCalled();

    const persisted = await prisma.event.findFirst({ where: { title } });
    expect(persisted).not.toBeNull();
    consoleSpy.mockRestore();
  });

  it("creates the event (201) when all-members notification fails", async () => {
    await setupUser(["events.manage"]);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(notifyAllActiveMembers).mockRejectedValueOnce(new Error("boom"));

    const title = `NotifyFailAll-${uniqueSuffix()}`;
    const res = await EVENTS_POST(
      mockRequest("/api/events", {
        method: "POST",
        body: {
          title,
          type: "PERFORMANCE",
          startAt: "2026-01-01T00:00:00.000Z",
        },
      })
    );
    expect(res.status).toBe(201);
    expect(consoleSpy).toHaveBeenCalled();

    const persisted = await prisma.event.findFirst({ where: { title } });
    expect(persisted).not.toBeNull();
    consoleSpy.mockRestore();
  });
});
