import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { POST as UPLOAD_URL_POST } from "@/app/api/gallery/upload-url/route";
import { POST as PERMS_POST } from "@/app/api/permissions/route";
import { DELETE as ROLE_DELETE } from "@/app/api/roles/[id]/route";
import { POST as ROLES_POST } from "@/app/api/roles/route";
import { PATCH as COMMITTEE_PATCH } from "@/app/api/committees/[id]/route";
import {
  POST as ASSIGN_ROLE,
  DELETE as REMOVE_ROLE,
} from "@/app/api/committees/[id]/roles/route";
import { PATCH as MEMBER_PATCH } from "@/app/api/members/[id]/route";
import {
  POST as ADD_DEPT,
  DELETE as REMOVE_DEPT,
} from "@/app/api/members/[id]/departments/route";
import { POST as DEPTS_POST } from "@/app/api/departments/route";
import { PATCH as DEPT_PATCH } from "@/app/api/departments/[id]/route";
import { POST as TASKS_POST } from "@/app/api/departments/[id]/tasks/route";
import {
  PATCH as TASK_PATCH,
  DELETE as TASK_DELETE,
} from "@/app/api/departments/[id]/tasks/[taskId]/route";
import { GET as TASKS_GET } from "@/app/api/departments/[id]/tasks/route";
import { PATCH as EVENT_PATCH, DELETE as EVENT_DELETE } from "@/app/api/events/[id]/route";
import { POST as EVENT_POST } from "@/app/api/events/route";
import { PATCH as UPDATE_PATCH, DELETE as UPDATE_DELETE } from "@/app/api/updates/[id]/route";
import { POST as UPDATE_POST } from "@/app/api/updates/route";
import { POST as GALLERY_POST } from "@/app/api/gallery/route";
import { POST as GALLERY_ITEM_POST } from "@/app/api/gallery/items/route";
import { PATCH as APPLICANT_PATCH } from "@/app/api/applicants/[id]/route";
import { GET as EXPORT_GET } from "@/app/api/applicants/export/route";
import { POST as PROMOS_POST } from "@/app/api/promotions/route";
import { POST as PROMO_SUBMIT } from "@/app/api/promotions/[id]/submit/route";
import { POST as PROMO_DECISION } from "@/app/api/promotions/[id]/decision/route";
import { POST as REGISTER_POST } from "@/app/api/auth/register/route";
import { POST as RW_POST } from "@/app/api/registration-windows/route";
import { POST as APPLY_POST } from "@/app/api/registration-windows/[id]/apply/route";
import { GET as MEMBER_DASH_GET } from "@/app/api/dashboard/member/route";
import { can } from "@/lib/permissions";
import { createNotification } from "@/lib/notifications";
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

const ADMIN_PERMISSIONS = [
  "permissions.manage",
  "member.create",
  "member.edit",
  "member.view",
  "department.manage",
  "department.view",
  "committee.manage",
  "registration.manage",
  "registration.review",
  "promotion.submit",
  "promotion.approve",
  "gallery.upload",
  "gallery.manage",
  "updates.publish",
  "events.manage",
  "settings.manage",
];

let realCreateNotification: typeof createNotification;

async function setupAdmin(perms: string[] = ADMIN_PERMISSIONS) {
  await seedPermissions();
  const { user } = await createTestUser({ email: `admin-exh-${uniqueSuffix()}@test.com` });
  const member = await createTestMember({ userId: user.id, status: "ACTIVE" });
  const committee = await createTestCommittee({ isCurrent: true });
  const role = await createTestRole({
    name: "ExhaustiveAdmin",
    permissionIds: (
      await Promise.all(
        perms.map(async (k) => {
          const p = await getTestPermission(k);
          return p!.id;
        })
      )
    ),
  });
  await assignCommitteeRole(member.id, role.id, committee.id);
  mockAuth(user.id, perms);
  return { userId: user.id, memberId: member.id, committeeId: committee.id };
}

function liveWindowBody() {
  return {
    title: `Window ${uniqueSuffix()}`,
    description: "Live recruitment window",
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "LIVE",
  };
}

describe("Gallery upload URL — file size validation (NFR §7)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    const { userId } = await setupAdmin(["gallery.upload"]);
    mockAuth(userId, ["gallery.upload"]);
  });

  const IMG = 10 * 1024 * 1024;
  const VID = 50 * 1024 * 1024;

  it("rejects oversized images (> 10 MB)", async () => {
    const res = await UPLOAD_URL_POST(
      mockRequest("/api/gallery/upload-url", {
        method: "POST",
        body: { fileName: "big.jpg", contentType: "image/jpeg", fileSize: IMG + 1 },
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("too large");
  });

  it("rejects oversized videos (> 50 MB)", async () => {
    const res = await UPLOAD_URL_POST(
      mockRequest("/api/gallery/upload-url", {
        method: "POST",
        body: { fileName: "big.mp4", contentType: "video/mp4", fileSize: VID + 1 },
      })
    );
    expect(res.status).toBe(400);
  });

  it("accepts an image exactly at the 10 MB limit", async () => {
    const res = await UPLOAD_URL_POST(
      mockRequest("/api/gallery/upload-url", {
        method: "POST",
        body: { fileName: "exact.jpg", contentType: "image/jpeg", fileSize: IMG },
      })
    );
    expect([200, 500]).toContain(res.status);
  });

  it("accepts a video at the 50 MB limit", async () => {
    const res = await UPLOAD_URL_POST(
      mockRequest("/api/gallery/upload-url", {
        method: "POST",
        body: { fileName: "exact.mp4", contentType: "video/mp4", fileSize: VID },
      })
    );
    expect([200, 500]).toContain(res.status);
  });

  it("accepts small files regardless of type", async () => {
    const res = await UPLOAD_URL_POST(
      mockRequest("/api/gallery/upload-url", {
        method: "POST",
        body: { fileName: "tiny.webm", contentType: "video/webm", fileSize: 1024 },
      })
    );
    expect([200, 500]).toContain(res.status);
  });

  it("rejects missing and non-positive fileSize", async () => {
    const missing = await UPLOAD_URL_POST(
      mockRequest("/api/gallery/upload-url", {
        method: "POST",
        body: { fileName: "a.jpg", contentType: "image/jpeg" },
      })
    );
    expect(missing.status).toBe(400);

    const zero = await UPLOAD_URL_POST(
      mockRequest("/api/gallery/upload-url", {
        method: "POST",
        body: { fileName: "a.jpg", contentType: "image/jpeg", fileSize: 0 },
      })
    );
    expect(zero.status).toBe(400);

    const negative = await UPLOAD_URL_POST(
      mockRequest("/api/gallery/upload-url", {
        method: "POST",
        body: { fileName: "a.jpg", contentType: "image/jpeg", fileSize: -5 },
      })
    );
    expect(negative.status).toBe(400);
  });
});

describe("§3b department scope — permission requirement on top of membership", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  it("denies a department member who holds no permission at all", async () => {
    const { user } = await createTestUser({});
    const member = await createTestMember({ userId: user.id, status: "ACTIVE" });
    const department = await createTestDepartment({});
    await assignDepartment(member.id, department.id);

    expect(await can(user.id, "department.manage", { departmentId: department.id })).toBe(false);
    expect(await can(user.id, "member.view", { departmentId: department.id })).toBe(false);
  });

  it("denies a coordinator who holds no permission at all", async () => {
    const { user } = await createTestUser({});
    const member = await createTestMember({ userId: user.id, status: "ACTIVE" });
    const department = await createTestDepartment({ coordinatorId: member.id });

    expect(await can(user.id, "department.manage", { departmentId: department.id })).toBe(false);
  });

  it("grants a department member holding the permission for that department only", async () => {
    const { user } = await createTestUser({});
    const member = await createTestMember({ userId: user.id, status: "ACTIVE" });
    const deptA = await createTestDepartment({});
    const deptB = await createTestDepartment({});
    await assignDepartment(member.id, deptA.id);
    const role = await createTestRole({
      name: "DeptMember",
      permissionIds: [(await getTestPermission("department.manage"))!.id],
    });
    const committee = await createTestCommittee({ isCurrent: true });
    await assignCommitteeRole(member.id, role.id, committee.id);

    expect(await can(user.id, "department.manage", { departmentId: deptA.id })).toBe(true);
    expect(await can(user.id, "department.manage", { departmentId: deptB.id })).toBe(false);
  });
});

describe("§9 smoke — custom role takes effect immediately", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
    await setupAdmin(["permissions.manage"]);
  });

  it("new role + permission is honored by the RBAC engine right after creation", async () => {
    const { user } = await createTestUser({ email: `b-member-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: user.id, status: "ACTIVE" });

    expect(await can(user.id, "member.create")).toBe(false);

    const perm = await getTestPermission("member.create");
    const res = await ROLES_POST(
      mockRequest("/api/roles", {
        method: "POST",
        body: { name: `FreshRole-${uniqueSuffix()}`, permissionIds: [perm!.id] },
      })
    );
    expect(res.status).toBe(201);
    const role = await res.json();

    const committee = await createTestCommittee({ isCurrent: true });
    await assignCommitteeRole(member.id, role.id, committee.id);

    expect(await can(user.id, "member.create")).toBe(true);
  });
});

describe("Register — password hashing roundtrip", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("stores a bcrypt hash that verifies against the plaintext password", async () => {
    const password = "Sup3rSecret!";
    const email = `hash-${uniqueSuffix()}@test.com`;
    const res = await REGISTER_POST(
      mockRequest("/api/auth/register", {
        method: "POST",
        headers: { "x-forwarded-for": `127.${uniqueSuffix().replace(/-/g, ".")}.1` },
        body: { name: "Hash User", email, password },
      })
    );
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email } });
    expect(created).not.toBeNull();
    expect(created!.passwordHash).not.toBe(password);
    expect(await bcrypt.compare(password, created!.passwordHash!)).toBe(true);
    expect(await bcrypt.compare("wrong-password", created!.passwordHash!)).toBe(false);
  });
});

describe("§3c — promotion REJECTED notification", () => {
  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    await setupAdmin(["promotion.submit", "promotion.approve"]);
    realCreateNotification = await vi.importActual<typeof import("@/lib/notifications")>(
      "@/lib/notifications"
    ).then((m) => m.createNotification);
  });

  it("fires a PROMOTION notification to the subject on rejection", async () => {
    const subjectUser = await createTestUser({ email: `subj-rej-${uniqueSuffix()}@test.com` });
    const subjectMember = await createTestMember({ userId: subjectUser.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const currentRole = await createTestRole({ name: `Current-${uniqueSuffix()}` });
    const proposedRole = await createTestRole({ name: `Proposed-${uniqueSuffix()}` });
    await assignCommitteeRole(subjectMember.id, currentRole.id, committee.id);

    vi.mocked(createNotification).mockImplementation(realCreateNotification);

    const created = await PROMOS_POST(
      mockRequest("/api/promotions", {
        method: "POST",
        body: {
          memberId: subjectMember.id,
          currentRoleId: currentRole.id,
          proposedRoleId: proposedRole.id,
          reason: "Requesting promotion",
        },
      })
    );
    expect(created.status).toBe(201);
    const promo = await created.json();

    const submitted = await PROMO_SUBMIT(
      mockRequest(`/api/promotions/${promo.id}/submit`, { method: "POST" }),
      { params: Promise.resolve({ id: promo.id }) }
    );
    expect(submitted.status).toBe(200);

    const decided = await PROMO_DECISION(
      mockRequest(`/api/promotions/${promo.id}/decision`, {
        method: "POST",
        body: { status: "REJECTED" },
      }),
      { params: Promise.resolve({ id: promo.id }) }
    );
    expect(decided.status).toBe(200);

    const notification = await prisma.notification.findFirst({
      where: { userId: subjectUser.user.id, type: "PROMOTION" },
      orderBy: { createdAt: "desc" },
    });
    expect(notification).not.toBeNull();
    expect(notification!.title).toBe("Promotion rejected");
    expect(notification!.payload as { status?: string }).toMatchObject({ status: "REJECTED" });
  });
});

describe("Audit trail — remaining actions (PRD §7)", () => {
  let adminUserId: string;
  let committeeId: string;

  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    ({ userId: adminUserId, committeeId } = await setupAdmin());
  });

  async function lastAudit(action: string) {
    return prisma.auditLog.findFirst({
      where: { action },
      orderBy: { createdAt: "desc" },
    });
  }

  it("user.registered — on public registration", async () => {
    const res = await REGISTER_POST(
      mockRequest("/api/auth/register", {
        method: "POST",
        headers: { "x-forwarded-for": `9.9.${uniqueSuffix().slice(0, 3)}.1` },
        body: { name: "Audit User", email: `aud-user-${uniqueSuffix()}@test.com`, password: "password123" },
      })
    );
    expect(res.status).toBe(201);
    const log = await lastAudit("user.registered");
    expect(log).not.toBeNull();
    expect(log!.entityType).toBe("User");
  });

  it("permissions.seed — on seed endpoint", async () => {
    const res = await PERMS_POST();
    expect(res.status).toBe(200);
    const log = await lastAudit("permissions.seed");
    expect(log).not.toBeNull();
    expect(log!.actorId).toBe(adminUserId);
    expect((log!.metadata as { count?: number }).count).toBeGreaterThan(0);
  });

  it("role.deleted — on role deletion", async () => {
    const role = await createTestRole({ name: `ToDelete-${uniqueSuffix()}` });
    const res = await ROLE_DELETE(
      mockRequest(`/api/roles/${role.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: role.id }) }
    );
    expect(res.status).toBe(200);
    const log = await lastAudit("role.deleted");
    expect(log).not.toBeNull();
    expect(log!.entityId).toBe(role.id);
  });

  it("committee.updated — on committee PATCH", async () => {
    const committee = await createTestCommittee({ isCurrent: true });
    const res = await COMMITTEE_PATCH(
      mockRequest(`/api/committees/${committee.id}`, {
        method: "PATCH",
        body: { year: "2099-2100" },
      }),
      { params: Promise.resolve({ id: committee.id }) }
    );
    expect(res.status).toBe(200);
    const log = await lastAudit("committee.updated");
    expect(log).not.toBeNull();
    expect(log!.entityId).toBe(committee.id);
  });

  it("committee.role_assigned / role_removed — on assign/remove", async () => {
    const member = await createTestMember({});
    const role = await createTestRole({ name: `Assign-${uniqueSuffix()}` });
    const assigned = await ASSIGN_ROLE(
      mockRequest(`/api/committees/${committeeId}/roles`, {
        method: "POST",
        body: { memberId: member.id, roleId: role.id },
      }),
      { params: Promise.resolve({ id: committeeId }) }
    );
    expect(assigned.status).toBe(201);
    const cmr = await prisma.committeeMemberRole.findFirst({
      where: { memberId: member.id, roleId: role.id },
    });
    const addLog = await lastAudit("committee.role_assigned");
    expect(addLog).not.toBeNull();
    expect(addLog!.entityId).toBe(cmr!.id);

    const removed = await REMOVE_ROLE(
      mockRequest(`/api/committees/${committeeId}/roles?memberRoleId=${cmr!.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: committeeId }) }
    );
    expect(removed.status).toBe(200);
    const rmLog = await lastAudit("committee.role_removed");
    expect(rmLog).not.toBeNull();
  });

  it("member.updated — on member PATCH", async () => {
    const member = await createTestMember({});
    const res = await MEMBER_PATCH(
      mockRequest(`/api/members/${member.id}`, {
        method: "PATCH",
        body: { phone: "555-0100" },
      }),
      { params: Promise.resolve({ id: member.id }) }
    );
    expect(res.status).toBe(200);
    const log = await lastAudit("member.updated");
    expect(log).not.toBeNull();
    expect(log!.entityId).toBe(member.id);
  });

  it("member.department_added / department_removed — on add/remove department", async () => {
    const member = await createTestMember({});
    const department = await createTestDepartment({ committeeId });
    const added = await ADD_DEPT(
      mockRequest(`/api/members/${member.id}/departments`, {
        method: "POST",
        body: { departmentId: department.id },
      }),
      { params: Promise.resolve({ id: member.id }) }
    );
    expect(added.status).toBe(201);
    const addLog = await lastAudit("member.department_added");
    expect(addLog).not.toBeNull();
    expect(addLog!.entityId).toBe(`${member.id}-${department.id}`);

    const removed = await REMOVE_DEPT(
      mockRequest(`/api/members/${member.id}/departments?departmentId=${department.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: member.id }) }
    );
    expect(removed.status).toBe(200);
    const rmLog = await lastAudit("member.department_removed");
    expect(rmLog).not.toBeNull();
    expect(rmLog!.entityId).toBe(`${member.id}-${department.id}`);
  });

  it("department.created / department.updated — on create and PATCH", async () => {
    const created = await DEPTS_POST(
      mockRequest("/api/departments", {
        method: "POST",
        body: { name: `Audit Dept ${uniqueSuffix()}`, committeeId },
      })
    );
    expect(created.status).toBe(201);
    const dept = await created.json();
    const createLog = await lastAudit("department.created");
    expect(createLog).not.toBeNull();
    expect(createLog!.entityId).toBe(dept.id);

    const patched = await DEPT_PATCH(
      mockRequest(`/api/departments/${dept.id}`, {
        method: "PATCH",
        body: { name: `Renamed ${uniqueSuffix()}` },
      }),
      { params: Promise.resolve({ id: dept.id }) }
    );
    expect(patched.status).toBe(200);
    const patchLog = await lastAudit("department.updated");
    expect(patchLog).not.toBeNull();
    expect(patchLog!.entityId).toBe(dept.id);
  });

  it("task.created / task.updated / task.deleted — full task lifecycle", async () => {
    const department = await createTestDepartment({ committeeId });
    const created = await TASKS_POST(
      mockRequest(`/api/departments/${department.id}/tasks`, {
        method: "POST",
        body: { title: `Audit Task ${uniqueSuffix()}` },
      }),
      { params: Promise.resolve({ id: department.id }) }
    );
    expect(created.status).toBe(201);
    const task = await created.json();
    const createLog = await lastAudit("task.created");
    expect(createLog).not.toBeNull();
    expect(createLog!.entityId).toBe(task.id);

    const patched = await TASK_PATCH(
      mockRequest(`/api/departments/${department.id}/tasks/${task.id}`, {
        method: "PATCH",
        body: { status: "IN_PROGRESS" },
      }),
      { params: Promise.resolve({ id: department.id, taskId: task.id }) }
    );
    expect(patched.status).toBe(200);
    const patchLog = await lastAudit("task.updated");
    expect(patchLog).not.toBeNull();

    const deleted = await TASK_DELETE(
      mockRequest(`/api/departments/${department.id}/tasks/${task.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: department.id, taskId: task.id }) }
    );
    expect(deleted.status).toBe(200);
    const deleteLog = await lastAudit("task.deleted");
    expect(deleteLog).not.toBeNull();
    expect(deleteLog!.entityId).toBe(task.id);
  });

  it("event.updated / event.deleted — on event PATCH and DELETE", async () => {
    const created = await EVENT_POST(
      mockRequest("/api/events", {
        method: "POST",
        body: {
          title: `Audit Event ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "UPCOMING",
          startAt: new Date(Date.now() + 86400000).toISOString(),
        },
      })
    );
    expect(created.status).toBe(201);
    const event = await created.json();

    const patched = await EVENT_PATCH(
      mockRequest(`/api/events/${event.id}`, {
        method: "PATCH",
        body: { title: `Audit Event Renamed ${uniqueSuffix()}` },
      }),
      { params: Promise.resolve({ id: event.id }) }
    );
    expect(patched.status).toBe(200);
    const patchLog = await lastAudit("event.updated");
    expect(patchLog).not.toBeNull();
    expect(patchLog!.entityId).toBe(event.id);

    const deleted = await EVENT_DELETE(
      mockRequest(`/api/events/${event.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: event.id }) }
    );
    expect(deleted.status).toBe(200);
    const deleteLog = await lastAudit("event.deleted");
    expect(deleteLog).not.toBeNull();
    expect(deleteLog!.entityId).toBe(event.id);
  });

  it("update.updated / update.deleted — on update PATCH and DELETE", async () => {
    const created = await UPDATE_POST(
      mockRequest("/api/updates", {
        method: "POST",
        body: {
          title: `Audit Update ${uniqueSuffix()}`,
          bodyRichText: "<p>Hello</p>",
          category: "ANNOUNCEMENT",
          publishedAt: new Date().toISOString(),
        },
      })
    );
    expect(created.status).toBe(201);
    const update = await created.json();

    const patched = await UPDATE_PATCH(
      mockRequest(`/api/updates/${update.id}`, {
        method: "PATCH",
        body: { title: `Renamed ${uniqueSuffix()}` },
      }),
      { params: Promise.resolve({ id: update.id }) }
    );
    expect(patched.status).toBe(200);
    const patchLog = await lastAudit("update.updated");
    expect(patchLog).not.toBeNull();
    expect(patchLog!.entityId).toBe(update.id);

    const deleted = await UPDATE_DELETE(
      mockRequest(`/api/updates/${update.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: update.id }) }
    );
    expect(deleted.status).toBe(200);
    const deleteLog = await lastAudit("update.deleted");
    expect(deleteLog).not.toBeNull();
    expect(deleteLog!.entityId).toBe(update.id);
  });

  it("gallery.album_created / gallery.item_uploaded — on album and item creation", async () => {
    const albumRes = await GALLERY_POST(
      mockRequest("/api/gallery", {
        method: "POST",
        body: { name: `Audit Album ${uniqueSuffix()}`, category: "CLUB_LIFE" },
      })
    );
    expect(albumRes.status).toBe(201);
    const album = await albumRes.json();
    const albumLog = await lastAudit("gallery.album_created");
    expect(albumLog).not.toBeNull();
    expect(albumLog!.entityId).toBe(album.id);

    const itemRes = await GALLERY_ITEM_POST(
      mockRequest("/api/gallery/items", {
        method: "POST",
        body: {
          albumId: album.id,
          r2Key: `gallery/${uniqueSuffix()}.jpg`,
          fileName: "audit.jpg",
          type: "IMAGE",
        },
      })
    );
    expect(itemRes.status).toBe(201);
    const item = await itemRes.json();
    const itemLog = await lastAudit("gallery.item_uploaded");
    expect(itemLog).not.toBeNull();
    expect(itemLog!.entityId).toBe(item.id);
  });

  it("applicant.rejected — on reject decision", async () => {
    const department = await createTestDepartment({ committeeId });
    const rw = await RW_POST(
      mockRequest("/api/registration-windows", {
        method: "POST",
        body: liveWindowBody(),
      })
    );
    expect(rw.status).toBe(201);
    const window = await rw.json();

    clearAuth();
    const applied = await APPLY_POST(
      mockRequest(`/api/registration-windows/${window.id}/apply`, {
        method: "POST",
        body: {
          name: "Applicant Reject",
          email: `reject-${uniqueSuffix()}@test.com`,
          phone: "1234567890",
          studentId: "S-REJ-1",
          departmentPrefs: [department.id],
          skills: ["acting"],
        },
      }),
      { params: Promise.resolve({ id: window.id }) }
    );
    expect(applied.status).toBe(201);
    const applicant = await applied.json();

    mockAuth(adminUserId, ["registration.review", "registration.manage"]);
    const decided = await APPLICANT_PATCH(
      mockRequest(`/api/applicants/${applicant.id}`, {
        method: "PATCH",
        body: { status: "REJECTED" },
      }),
      { params: Promise.resolve({ id: applicant.id }) }
    );
    expect(decided.status).toBe(200);
    const log = await lastAudit("applicant.rejected");
    expect(log).not.toBeNull();
    expect(log!.entityId).toBe(applicant.id);
    expect((log!.metadata as { newStatus?: string }).newStatus).toBe("REJECTED");
  });

  it("applicant.exported — on CSV export", async () => {
    const department = await createTestDepartment({ committeeId });
    const rw = await RW_POST(
      mockRequest("/api/registration-windows", {
        method: "POST",
        body: liveWindowBody(),
      })
    );
    const window = await rw.json();

    clearAuth();
    await APPLY_POST(
      mockRequest(`/api/registration-windows/${window.id}/apply`, {
        method: "POST",
        body: {
          name: "Export Me",
          email: `export-${uniqueSuffix()}@test.com`,
          phone: "1234567890",
          studentId: "S-EXP-1",
          departmentPrefs: [department.id],
        },
      }),
      { params: Promise.resolve({ id: window.id }) }
    );

    mockAuth(adminUserId, ["registration.review"]);
    const res = await EXPORT_GET(
      mockRequest("/api/applicants/export", {
        searchParams: { windowId: window.id },
      })
    );
    expect(res.status).toBe(200);
    const log = await lastAudit("applicant.exported");
    expect(log).not.toBeNull();
    expect(log!.entityId).toBe(window.id);
  });
});

describe("§5 — tasks GET for department members without department.manage", () => {
  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    await seedPermissions();
  });

  it("allows a department member holding only department.view to list tasks", async () => {
    const committee = await createTestCommittee({ isCurrent: true });
    const department = await createTestDepartment({ committeeId: committee.id });
    const { user } = await createTestUser({ email: `deptmem-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: user.id, status: "ACTIVE" });
    await assignDepartment(member.id, department.id);
    const role = await createTestRole({
      name: "DeptView",
      permissionIds: [(await getTestPermission("department.view"))!.id],
    });
    await assignCommitteeRole(member.id, role.id, committee.id);

    const task = await prisma.task.create({
      data: { departmentId: department.id, title: `Visible ${uniqueSuffix()}` },
    });
    await prisma.task.create({
      data: { departmentId: department.id, title: `Visible2 ${uniqueSuffix()}` },
    });

    mockAuth(user.id, ["department.view"]);
    const res = await TASKS_GET(
      mockRequest(`/api/departments/${department.id}/tasks`),
      { params: Promise.resolve({ id: department.id }) }
    );
    expect(res.status).toBe(200);
    const tasks = await res.json();
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t: { id: string }) => t.id)).toContain(task.id);
  });

  it("still denies tasks GET without any permission", async () => {
    const department = await createTestDepartment({});
    const { user } = await createTestUser({ email: `noperm-${uniqueSuffix()}@test.com` });
    mockAuth(user.id, []);
    const res = await TASKS_GET(
      mockRequest(`/api/departments/${department.id}/tasks`),
      { params: Promise.resolve({ id: department.id }) }
    );
    expect(res.status).toBe(403);
  });
});

describe("§12 — member dashboard own-data isolation", () => {
  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    await seedPermissions();
  });

  it("excludes other users' notifications and other departments' events", async () => {
    const committee = await createTestCommittee({ isCurrent: true });
    const deptA = await createTestDepartment({ committeeId: committee.id, name: "DeptA" });
    const deptB = await createTestDepartment({ committeeId: committee.id, name: "DeptB" });

    const { user: userA } = await createTestUser({ email: `dash-a-${uniqueSuffix()}@test.com` });
    const memberA = await createTestMember({ userId: userA.id, status: "ACTIVE" });
    await assignDepartment(memberA.id, deptA.id);

    const { user: userB } = await createTestUser({ email: `dash-b-${uniqueSuffix()}@test.com` });

    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const myEvent = await prisma.event.create({
      data: { title: "My Dept Event", type: "WORKSHOP", status: "UPCOMING", startAt: future, departmentId: deptA.id },
    });
    const otherDeptEvent = await prisma.event.create({
      data: { title: "Other Dept Event", type: "PERFORMANCE", status: "UPCOMING", startAt: future, departmentId: deptB.id },
    });
    const clubWideEvent = await prisma.event.create({
      data: { title: "Club Wide", type: "FESTIVAL", status: "UPCOMING", startAt: future },
    });
    const draftEvent = await prisma.event.create({
      data: { title: "Draft Event", type: "WORKSHOP", status: "DRAFT", startAt: future, departmentId: deptA.id },
    });
    const pastEvent = await prisma.event.create({
      data: { title: "Past Event", type: "WORKSHOP", status: "COMPLETED", startAt: past, departmentId: deptA.id },
    });

    await prisma.notification.create({
      data: { userId: userA.id, type: "ANNOUNCEMENT", title: "Mine", message: "mine", payload: {} },
    });
    await prisma.notification.create({
      data: { userId: userB.id, type: "PROMOTION", title: "Theirs", message: "theirs", payload: {} },
    });

    mockAuth(userA.id, []);
    const res = await MEMBER_DASH_GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    const eventIds = data.upcomingEvents.map((e: { id: string }) => e.id);
    expect(eventIds).toContain(myEvent.id);
    expect(eventIds).toContain(clubWideEvent.id);
    expect(eventIds).not.toContain(otherDeptEvent.id);
    expect(eventIds).not.toContain(draftEvent.id);
    expect(eventIds).not.toContain(pastEvent.id);

    const notifIds = data.recentNotifications.map((n: { id: string }) => n.id);
    expect(notifIds).toHaveLength(1);
    expect(data.recentNotifications[0].title).toBe("Mine");
  });

  it("returns empty slices for a user without a member profile", async () => {
    const { user } = await createTestUser({ email: `dash-nomem-${uniqueSuffix()}@test.com` });
    mockAuth(user.id, []);
    const res = await MEMBER_DASH_GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.member).toBeNull();
    expect(data.departments).toEqual([]);
    expect(data.upcomingEvents).toEqual([]);
    expect(data.recentNotifications).toEqual([]);
  });
});
