import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET as CONTACTS_GET } from "@/app/api/contacts/route";
import { PATCH as CONTACT_PATCH } from "@/app/api/contacts/[id]/route";
import { DELETE as CONTACT_DELETE } from "@/app/api/contacts/[id]/route";
import { GET as STORAGE_GET } from "@/app/api/settings/storage/route";
import { GET as MEMBER_GET } from "@/app/api/members/[id]/route";
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
  assignDepartment,
  createTestDepartment,
  uniqueSuffix,
} from "./helpers";
import prisma from "@/lib/prisma";

describe("Contact messages inbox", () => {
  let adminUserId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `contacts-admin-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const adminMember = await createTestMember({ userId: adminUserId, status: "ACTIVE" });

    const permissionIds = (
      await Promise.all(
        ["settings.manage", "permissions.manage"].map(async (k) => {
          const p = await prisma.permission.findUnique({ where: { key: k } });
          return p!.id;
        })
      )
    );
    const adminRole = await createTestRole({ name: "Admin", permissionIds });
    const committee = await createTestCommittee({ isCurrent: true });
    await assignCommitteeRole(adminMember.id, adminRole.id, committee.id);

    mockAuth(adminUserId, ["settings.manage", "permissions.manage"]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when unauthenticated", async () => {
    clearAuth();
    const res = await CONTACTS_GET(mockRequest("/api/contacts"));
    expect(res.status).toBe(401);
  });

  it("returns 403 without settings.manage", async () => {
    const outsider = await createTestUser({ email: `contacts-out-${uniqueSuffix()}@test.com` });
    mockAuth(outsider.user.id, []);
    const res = await CONTACTS_GET(mockRequest("/api/contacts"));
    expect(res.status).toBe(403);
  });

  it("lists submissions filtered by status with pagination", async () => {
    const open = await prisma.contactSubmission.create({
      data: { name: "Open Sender", email: "open@test.com", message: "hello" },
    });
    const handled = await prisma.contactSubmission.create({
      data: {
        name: "Handled Sender",
        email: "done@test.com",
        message: "thanks",
        handledAt: new Date("2026-01-01"),
      },
    });

    const openRes = await CONTACTS_GET(mockRequest("/api/contacts?status=open"));
    expect(openRes.status).toBe(200);
    const openData = await openRes.json();
    expect(openData.submissions.map((s: { id: string }) => s.id)).toContain(open.id);
    expect(openData.submissions.map((s: { id: string }) => s.id)).not.toContain(handled.id);

    const handledRes = await CONTACTS_GET(mockRequest("/api/contacts?status=handled"));
    const handledData = await handledRes.json();
    expect(handledData.submissions.map((s: { id: string }) => s.id)).toEqual([handled.id]);

    const allRes = await CONTACTS_GET(mockRequest("/api/contacts?status=all"));
    const allData = await allRes.json();
    expect(allData.pagination.total).toBe(2);
  });

  it("marks a submission handled and reopens it, with audit entries", async () => {
    const sub = await prisma.contactSubmission.create({
      data: { name: "A", email: "a@test.com", message: "msg" },
    });

    const patchRes = await CONTACT_PATCH(mockRequest(`/api/contacts/${sub.id}`, { method: "PATCH", body: { handled: true } }), {
      params: Promise.resolve({ id: sub.id }),
    });
    expect(patchRes.status).toBe(200);
    let updated = await prisma.contactSubmission.findUnique({ where: { id: sub.id } });
    expect(updated?.handledAt).not.toBeNull();

    const reopenRes = await CONTACT_PATCH(mockRequest(`/api/contacts/${sub.id}`, { method: "PATCH", body: { handled: false } }), {
      params: Promise.resolve({ id: sub.id }),
    });
    expect(reopenRes.status).toBe(200);
    updated = await prisma.contactSubmission.findUnique({ where: { id: sub.id } });
    expect(updated?.handledAt).toBeNull();

    const audit = await prisma.auditLog.findMany({
      where: { entityId: sub.id },
      orderBy: { createdAt: "asc" },
    });
    expect(audit.map((a) => a.action)).toEqual(["contact.handled", "contact.reopened"]);
  });

  it("returns 404 for unknown submission id", async () => {
    const res = await CONTACT_PATCH(mockRequest("/api/contacts/cl00000000000000000000000", { method: "PATCH", body: { handled: true } }), {
      params: Promise.resolve({ id: "cl00000000000000000000000" }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes a submission with audit entry", async () => {
    const sub = await prisma.contactSubmission.create({
      data: { name: "B", email: "b@test.com", message: "msg" },
    });

    const res = await CONTACT_DELETE(mockRequest(`/api/contacts/${sub.id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: sub.id }),
    });
    expect(res.status).toBe(200);
    expect(await prisma.contactSubmission.findUnique({ where: { id: sub.id } })).toBeNull();

    const audit = await prisma.auditLog.findMany({ where: { entityId: sub.id } });
    expect(audit.map((a) => a.action)).toContain("contact.deleted");
  });
});

describe("Storage status endpoint", () => {
  let adminUserId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
    const admin = await createTestUser({ email: `storage-admin-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const adminMember = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    const permissionIds = [(
      await prisma.permission.findUnique({ where: { key: "settings.manage" } })
    )!.id];
    const adminRole = await createTestRole({ name: "Admin", permissionIds });
    const committee = await createTestCommittee({ isCurrent: true });
    await assignCommitteeRole(adminMember.id, adminRole.id, committee.id);
    mockAuth(adminUserId, ["settings.manage"]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports unconfigured when R2 env vars are missing, without leaking secrets", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "");
    vi.stubEnv("R2_ACCESS_KEY_ID", "");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
    vi.stubEnv("R2_BUCKET_NAME", "");
    vi.stubEnv("R2_PUBLIC_URL", "");

    const res = await STORAGE_GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.configured).toBe(false);
    expect(data.missing).toContain("R2_ACCOUNT_ID");
    expect(data.missing).toContain("R2_SECRET_ACCESS_KEY");
    expect(JSON.stringify(data)).not.toContain("super-secret");
  });

  it("reports configured with bucket and public url when env vars are set", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "acct");
    vi.stubEnv("R2_ACCESS_KEY_ID", "key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "super-secret");
    vi.stubEnv("R2_BUCKET_NAME", "dcms-media");
    vi.stubEnv("R2_PUBLIC_URL", "https://cdn.example.com");

    const res = await STORAGE_GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.configured).toBe(true);
    expect(data.bucket).toBe("dcms-media");
    expect(data.publicUrl).toBe("https://cdn.example.com");
    expect(data.missing).toEqual([]);
  });

  it("returns 403 without settings.manage", async () => {
    const outsider = await createTestUser({ email: `storage-out-${uniqueSuffix()}@test.com` });
    mockAuth(outsider.user.id, []);
    const res = await STORAGE_GET();
    expect(res.status).toBe(403);
  });
});

describe("Member profile endpoint", () => {
  let adminUserId: string;
  let adminMemberId: string;
  let committeeId: string;
  let roleId: string;
  let departmentId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `profile-admin-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const adminMember = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    adminMemberId = adminMember.id;

    const committee = await createTestCommittee({ isCurrent: true });
    committeeId = committee.id;
    const permissionIds = (
      await Promise.all(
        ["member.view", "member.edit"].map(async (k) => {
          const p = await prisma.permission.findUnique({ where: { key: k } });
          return p!.id;
        })
      )
    );
    const role = await createTestRole({ name: "Member", permissionIds });
    roleId = role.id;
    const department = await createTestDepartment({ committeeId });
    departmentId = department.id;

    await assignCommitteeRole(adminMemberId, roleId, committeeId);
    await assignDepartment(adminMemberId, departmentId);

    mockAuth(adminUserId, ["member.view", "member.edit"]);
  });

  it("returns the full profile with committee roles and departments", async () => {
    const res = await MEMBER_GET(mockRequest(`/api/members/${adminMemberId}`), {
      params: Promise.resolve({ id: adminMemberId }),
    });
    expect(res.status).toBe(200);
    const member = await res.json();
    expect(member.id).toBe(adminMemberId);
    expect(member.user.email).toMatch(/@test\.com$/);
    expect(member.committeeRoles).toHaveLength(1);
    expect(member.committeeRoles[0].role.name).toMatch(/Member/);
    expect(member.committeeRoles[0].committee.isCurrent).toBe(true);
    expect(member.departments).toHaveLength(1);
    expect(member.departments[0].department.name).toMatch(/Dept/);
  });

  it("returns 404 for unknown member", async () => {
    const res = await MEMBER_GET(mockRequest("/api/members/cl00000000000000000000000"), {
      params: Promise.resolve({ id: "cl00000000000000000000000" }),
    });
    expect(res.status).toBe(404);
  });
});
