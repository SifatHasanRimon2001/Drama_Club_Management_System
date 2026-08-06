import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST as APPLY } from "@/app/api/registration-windows/[id]/apply/route";
import { PATCH as RW_PATCH } from "@/app/api/registration-windows/[id]/route";
import { POST as PROMOTIONS_POST } from "@/app/api/promotions/route";
import { POST as PROMO_DECISION } from "@/app/api/promotions/[id]/decision/route";
import { POST as ROLES_POST } from "@/app/api/roles/route";
import { PATCH as ROLE_PATCH, DELETE as ROLE_DELETE } from "@/app/api/roles/[id]/route";
import { POST as MEMBERS_POST } from "@/app/api/members/route";
import { PATCH as MEMBER_PATCH } from "@/app/api/members/[id]/route";
import { POST as CONVERT_POST } from "@/app/api/applicants/[id]/convert/route";
import { POST as GALLERY_ITEMS_POST } from "@/app/api/gallery/items/route";
import { clientIpKey, RateLimiter } from "@/lib/rate-limit";
import {
  mockRequest,
  mockAuth,
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

/**
 * Backend hardening tests: verifies security/robustness fixes that close
 * gaps found during the full-backend audit:
 *  - shared rate limiter (client-key derivation, window, cleanup)
 *  - apply route: required custom fields enforced, empty required numbers
 *    rejected, duplicate form field names rejected, duplicate-email race -> 409
 *  - registration window state machine enforcement
 *  - promotion request role-holding validation
 *  - role permissionId validation and delete protection
 *  - member creation user-existence check
 *  - gallery item r2Key sanitization
 */

async function setupAdmin(perms: string[]) {
  await seedPermissions();
  const { user } = await createTestUser({ email: `hard-admin-${uniqueSuffix()}@test.com` });
  const member = await createTestMember({ userId: user.id, status: "ACTIVE" });
  const committee = await createTestCommittee({ isCurrent: true });
  const role = await createTestRole({
    name: `HardAdmin-${uniqueSuffix()}`,
    permissionIds: (
      await Promise.all(
        perms.map(async (k) => {
          const p = await prisma.permission.findUnique({ where: { key: k } });
          return p!.id;
        })
      )
    ),
  });
  await assignCommitteeRole(member.id, role.id, committee.id);
  mockAuth(user.id, perms);
  return { userId: user.id, memberId: member.id, committeeId: committee.id };
}

async function liveWindow(formSchema?: Record<string, unknown>) {
  return prisma.registrationWindow.create({
    data: {
      title: `HardRW ${uniqueSuffix()}`,
      description: "desc",
      startDate: new Date("2020-01-01"),
      endDate: new Date("2030-01-01"),
      status: "LIVE",
      formSchema: (formSchema ?? {}) as object,
    },
  });
}

function baseBody(email?: string, prefs?: string[]) {
  return {
    name: "Hardening Applicant",
    email: email ?? `hard-${uniqueSuffix()}@test.com`,
    phone: "1234567890",
    studentId: `STU${uniqueSuffix()}`,
    departmentPrefs: prefs ?? [departmentId],
  };
}

let departmentId: string;

describe("Rate limiter library (src/lib/rate-limit.ts)", () => {
  it("clientIpKey prefers x-forwarded-for first value", () => {
    const req = mockRequest("/api/x", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    expect(clientIpKey(req)).toBe("203.0.113.1");
  });

  it("clientIpKey falls back to x-real-ip", () => {
    const req = mockRequest("/api/x", { headers: { "x-real-ip": "198.51.100.7" } });
    expect(clientIpKey(req)).toBe("198.51.100.7");
  });

  it("clientIpKey hashes User-Agent when no proxy headers exist (no shared bucket)", () => {
    const reqA = mockRequest("/api/x", { headers: { "user-agent": "Mozilla A" } });
    const reqB = mockRequest("/api/x", { headers: { "user-agent": "Mozilla B" } });
    const reqA2 = mockRequest("/api/x", { headers: { "user-agent": "Mozilla A" } });
    expect(clientIpKey(reqA)).toBe(clientIpKey(reqA2));
    expect(clientIpKey(reqA)).not.toBe(clientIpKey(reqB));
  });

  it("RateLimiter blocks after the limit and resets after the window", () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(2, 60_000);
    const t0 = Date.now();
    expect(limiter.allow("k1")).toBe(true);
    expect(limiter.allow("k1")).toBe(true);
    expect(limiter.allow("k1")).toBe(false);
    expect(limiter.allow("k2")).toBe(true); // separate bucket unaffected

    vi.setSystemTime(new Date(t0 + 61_000));
    expect(limiter.allow("k1")).toBe(true); // window expired -> allowed
    vi.useRealTimers();
  });

  it("RateLimiter purges expired entries during cleanup and can be reset", () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(1, 60_000, 60_000);
    const t0 = Date.now();
    limiter.allow("old");
    vi.setSystemTime(new Date(t0 + 120_000));
    expect(limiter.allow("old")).toBe(true); // expired during cleanup

    limiter.allow("again");
    limiter.reset();
    expect(limiter.allow("again")).toBe(true); // reset clears all state
    vi.useRealTimers();
  });
});

describe("Apply route hardening", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
    const committee = await createTestCommittee({ isCurrent: true });
    const dept = await createTestDepartment({ committeeId: committee.id });
    departmentId = dept.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a submission that omits customResponses when the window has required fields", async () => {
    const rw = await liveWindow({
      fields: [{ name: "experience", type: "text", required: true, label: "Experience" }],
    });

    const res = await APPLY(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: baseBody(),
        headers: { "x-forwarded-for": `10.200.${Math.floor(Math.random() * 50) + 1}.1` },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Custom field validation");
  });

  it("rejects an empty string for a required number field", async () => {
    const rw = await liveWindow({
      fields: [{ name: "years", type: "number", required: true, label: "Years" }],
    });

    const res = await APPLY(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: { ...baseBody(), customResponses: { years: "" } },
        headers: { "x-forwarded-for": `10.200.${Math.floor(Math.random() * 50) + 1}.1` },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("accepts a valid number for a required number field", async () => {
    const rw = await liveWindow({
      fields: [{ name: "years", type: "number", required: true, label: "Years" }],
    });

    const res = await APPLY(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: { ...baseBody(), customResponses: { years: 3 } },
        headers: { "x-forwarded-for": `10.200.${Math.floor(Math.random() * 50) + 1}.1` },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(201);
  });

  it("rejects a form schema with duplicate field names", async () => {
    const rw = await liveWindow({
      fields: [
        { name: "dup", type: "text", required: true },
        { name: "dup", type: "textarea" },
      ],
    });

    const res = await APPLY(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: { ...baseBody(), customResponses: { dup: "x" } },
        headers: { "x-forwarded-for": `10.200.${Math.floor(Math.random() * 50) + 1}.1` },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("duplicate");
  });

  it("returns 409 (not 500) when a concurrent duplicate hits the DB unique constraint", async () => {
    const rw = await liveWindow();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const p2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    vi.spyOn(prisma.applicant, "create").mockRejectedValueOnce(p2002);

    const res = await APPLY(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: baseBody(),
        headers: { "x-forwarded-for": `10.200.${Math.floor(Math.random() * 50) + 1}.1` },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(409);
    consoleSpy.mockRestore();
  });

  it("rate-limits headerless clients per User-Agent instead of a shared anonymous bucket", async () => {
    const rw = await liveWindow();
    const emailBase = `anon-${uniqueSuffix()}`;

    for (let i = 1; i <= 3; i++) {
      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: baseBody(`${emailBase}-${i}@test.com`),
          headers: { "user-agent": "Hardening-UA" },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(201);
    }

    const blocked = await APPLY(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: baseBody(`${emailBase}-4@test.com`),
        headers: { "user-agent": "Hardening-UA" },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(blocked.status).toBe(429);

    const other = await APPLY(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: baseBody(`${emailBase}-5@test.com`),
        headers: { "user-agent": "Different-UA" },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(other.status).toBe(201); // different UA -> separate bucket
  });
});

describe("Registration window state machine (PATCH)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  async function createWindowWith(status: string) {
    await setupAdmin(["registration.manage"]);
    return prisma.registrationWindow.create({
      data: {
        title: `SM ${uniqueSuffix()}`,
        description: "d",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2030-01-01"),
        status: status as "DRAFT" | "SCHEDULED" | "LIVE" | "CLOSED",
      },
    });
  }

  it("allows the forward path DRAFT -> SCHEDULED -> LIVE -> CLOSED", async () => {
    const rw = await createWindowWith("DRAFT");

    const s1 = await RW_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "SCHEDULED" } }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(s1.status).toBe(200);

    const s2 = await RW_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "LIVE" } }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(s2.status).toBe(200);

    const s3 = await RW_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "CLOSED" } }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(s3.status).toBe(200);
  });

  it("allows CLOSED -> LIVE (reopen)", async () => {
    const rw = await createWindowWith("CLOSED");
    const res = await RW_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "LIVE" } }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(200);
  });

  it("rejects LIVE -> DRAFT (backward transition)", async () => {
    const rw = await createWindowWith("LIVE");
    const res = await RW_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "DRAFT" } }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("rejects LIVE -> SCHEDULED", async () => {
    const rw = await createWindowWith("LIVE");
    const res = await RW_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "SCHEDULED" } }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("rejects CLOSED -> DRAFT", async () => {
    const rw = await createWindowWith("CLOSED");
    const res = await RW_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "DRAFT" } }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("rejects DRAFT -> CLOSED (skips the machine)", async () => {
    const rw = await createWindowWith("DRAFT");
    const res = await RW_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "CLOSED" } }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("rejects SCHEDULED -> CLOSED (skips the machine)", async () => {
    const rw = await createWindowWith("SCHEDULED");
    const res = await RW_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "CLOSED" } }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("keeps a live window live when the status is unchanged (no-op update)", async () => {
    const rw = await createWindowWith("LIVE");
    const res = await RW_PATCH(
      mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "LIVE", title: "Renamed" } }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("LIVE");
    expect(data.title).toBe("Renamed");
  });
});

describe("Promotion request role validation", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  it("rejects a promotion whose current role is not held by the member", async () => {
    const { userId } = await setupAdmin(["promotion.submit"]);
    const subjectUser = await createTestUser({ email: `p-subject-${uniqueSuffix()}@test.com` });
    const subjectMember = await createTestMember({ userId: subjectUser.user.id, status: "ACTIVE" });
    const currentRole = await createTestRole({ name: `NotHeld-${uniqueSuffix()}` });
    const proposedRole = await createTestRole({ name: `Target-${uniqueSuffix()}` });
    void userId;

    const res = await PROMOTIONS_POST(
      mockRequest("/api/promotions", {
        method: "POST",
        body: {
          memberId: subjectMember.id,
          currentRoleId: currentRole.id,
          proposedRoleId: proposedRole.id,
          reason: "Promote me",
        },
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("does not currently hold");
  });

  it("rejects a promotion where proposed role equals current role", async () => {
    await setupAdmin(["promotion.submit"]);
    const subjectUser = await createTestUser({ email: `p-eq-${uniqueSuffix()}@test.com` });
    const subjectMember = await createTestMember({ userId: subjectUser.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const role = await createTestRole({ name: `SameRole-${uniqueSuffix()}` });
    await assignCommitteeRole(subjectMember.id, role.id, committee.id);

    const res = await PROMOTIONS_POST(
      mockRequest("/api/promotions", {
        method: "POST",
        body: {
          memberId: subjectMember.id,
          currentRoleId: role.id,
          proposedRoleId: role.id,
          reason: "Same role",
        },
      })
    );
    expect(res.status).toBe(400);
  });

  it("accepts a promotion when the member holds the current role", async () => {
    await setupAdmin(["promotion.submit"]);
    const subjectUser = await createTestUser({ email: `p-ok-${uniqueSuffix()}@test.com` });
    const subjectMember = await createTestMember({ userId: subjectUser.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const currentRole = await createTestRole({ name: `Held-${uniqueSuffix()}` });
    const proposedRole = await createTestRole({ name: `Goal-${uniqueSuffix()}` });
    await assignCommitteeRole(subjectMember.id, currentRole.id, committee.id);

    const res = await PROMOTIONS_POST(
      mockRequest("/api/promotions", {
        method: "POST",
        body: {
          memberId: subjectMember.id,
          currentRoleId: currentRole.id,
          proposedRoleId: proposedRole.id,
          reason: "Legit promotion",
        },
      })
    );
    expect(res.status).toBe(201);
  });
});

describe("Role permission validation and delete protection", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  it("returns 400 when POSTing a role with an unknown permission ID", async () => {
    await setupAdmin(["permissions.manage"]);
    const res = await ROLES_POST(
      mockRequest("/api/roles", {
        method: "POST",
        body: { name: `BadRole-${uniqueSuffix()}`, permissionIds: ["cl00000000000000000000000"] },
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Unknown permission ID");
  });

  it("dedupes duplicate permission IDs when POSTing a role", async () => {
    await setupAdmin(["permissions.manage"]);
    const perm = await prisma.permission.findUnique({ where: { key: "member.view" } });

    const res = await ROLES_POST(
      mockRequest("/api/roles", {
        method: "POST",
        body: { name: `DedupRole-${uniqueSuffix()}`, permissionIds: [perm!.id, perm!.id] },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.permissions).toHaveLength(1);
  });

  it("returns 400 when PATCHing a role with an unknown permission ID", async () => {
    await setupAdmin(["permissions.manage"]);
    const role = await createTestRole({ name: `PatchRole-${uniqueSuffix()}` });

    const res = await ROLE_PATCH(
      mockRequest(`/api/roles/${role.id}`, {
        method: "PATCH",
        body: { permissionIds: ["cl00000000000000000000000"] },
      }),
      { params: Promise.resolve({ id: role.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when deleting a role referenced by a promotion", async () => {
    const { userId } = await setupAdmin(["permissions.manage"]);
    const subjectUser = await createTestUser({ email: `rd-${uniqueSuffix()}@test.com` });
    const subjectMember = await createTestMember({ userId: subjectUser.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const currentRole = await createTestRole({ name: `RefCurrent-${uniqueSuffix()}` });
    const proposedRole = await createTestRole({ name: `RefProposed-${uniqueSuffix()}` });
    await assignCommitteeRole(subjectMember.id, currentRole.id, committee.id);

    await prisma.promotionRequest.create({
      data: {
        memberId: subjectMember.id,
        currentRoleId: currentRole.id,
        proposedRoleId: proposedRole.id,
        reason: "ref",
        submittedById: userId,
        status: "DRAFT",
      },
    });

    const res = await ROLE_DELETE(mockRequest(`/api/roles/${proposedRole.id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: proposedRole.id }),
    });
    expect(res.status).toBe(409);

    const stillThere = await prisma.role.findUnique({ where: { id: proposedRole.id } });
    expect(stillThere).not.toBeNull();
  });

  it("deletes an unreferenced role successfully", async () => {
    await setupAdmin(["permissions.manage"]);
    const role = await createTestRole({ name: `Orphan-${uniqueSuffix()}` });

    const res = await ROLE_DELETE(mockRequest(`/api/roles/${role.id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: role.id }),
    });
    expect(res.status).toBe(200);
  });
});

describe("Member creation user-existence check", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  it("returns 400 when the referenced user does not exist", async () => {
    await setupAdmin(["member.create"]);
    const res = await MEMBERS_POST(
      mockRequest("/api/members", {
        method: "POST",
        body: { userId: "cl00000000000000000000000", memberCode: `M-${uniqueSuffix()}` },
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("User not found");
  });

  it("still creates a member for an existing user", async () => {
    await setupAdmin(["member.create"]);
    const fresh = await createTestUser({ email: `mem-${uniqueSuffix()}@test.com` });
    const res = await MEMBERS_POST(
      mockRequest("/api/members", {
        method: "POST",
        body: { userId: fresh.user.id, memberCode: `M-${uniqueSuffix()}` },
      })
    );
    expect(res.status).toBe(201);
  });
});

describe("Gallery item r2Key sanitization", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
    await setupAdmin(["gallery.upload"]);
  });

  it("rejects a path-traversal r2Key", async () => {
    const album = await prisma.galleryAlbum.create({
      data: { name: `Alb ${uniqueSuffix()}`, category: "PRODUCTIONS" },
    });
    const res = await GALLERY_ITEMS_POST(
      mockRequest("/api/gallery/items", {
        method: "POST",
        body: { albumId: album.id, r2Key: "../secret.jpg", fileName: "x.jpg", type: "IMAGE" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects an absolute-path r2Key", async () => {
    const album = await prisma.galleryAlbum.create({
      data: { name: `Alb ${uniqueSuffix()}`, category: "PRODUCTIONS" },
    });
    const res = await GALLERY_ITEMS_POST(
      mockRequest("/api/gallery/items", {
        method: "POST",
        body: { albumId: album.id, r2Key: "/etc/passwd", fileName: "x", type: "IMAGE" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("accepts a normal r2Key", async () => {
    const album = await prisma.galleryAlbum.create({
      data: { name: `Alb ${uniqueSuffix()}`, category: "PRODUCTIONS" },
    });
    const res = await GALLERY_ITEMS_POST(
      mockRequest("/api/gallery/items", {
        method: "POST",
        body: { albumId: album.id, r2Key: "gallery/1234_photo.jpg", fileName: "photo.jpg", type: "IMAGE" },
      })
    );
    expect(res.status).toBe(201);
  });
});

describe("Member profile fields (photoUrl, joiningDate)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  it("creates a member with a photoUrl", async () => {
    await setupAdmin(["member.create"]);
    const fresh = await createTestUser({ email: `photo-${uniqueSuffix()}@test.com` });
    const res = await MEMBERS_POST(
      mockRequest("/api/members", {
        method: "POST",
        body: {
          userId: fresh.user.id,
          memberCode: `M-${uniqueSuffix()}`,
          photoUrl: "https://example.com/photo.jpg",
        },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.photoUrl).toBe("https://example.com/photo.jpg");
  });

  it("rejects an invalid photoUrl on create", async () => {
    await setupAdmin(["member.create"]);
    const fresh = await createTestUser({ email: `badphoto-${uniqueSuffix()}@test.com` });
    const res = await MEMBERS_POST(
      mockRequest("/api/members", {
        method: "POST",
        body: {
          userId: fresh.user.id,
          memberCode: `M-${uniqueSuffix()}`,
          photoUrl: "not-a-url",
        },
      })
    );
    expect(res.status).toBe(400);
  });

  it("updates photoUrl via PATCH", async () => {
    await setupAdmin(["member.edit"]);
    const { user } = await createTestUser({ email: `p2-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: user.id, status: "ACTIVE" });

    const res = await MEMBER_PATCH(
      mockRequest(`/api/members/${member.id}`, {
        method: "PATCH",
        body: { photoUrl: "https://example.com/new-photo.png" },
      }),
      { params: Promise.resolve({ id: member.id }) }
    );
    expect(res.status).toBe(200);
    const updated = await prisma.member.findUnique({ where: { id: member.id } });
    expect(updated!.photoUrl).toBe("https://example.com/new-photo.png");
  });

  it("sets joiningDate when an applicant is converted to a member", async () => {
    await setupAdmin(["member.create", "registration.review"]);
    const committee = await createTestCommittee({ isCurrent: true });
    const dept = await createTestDepartment({ committeeId: committee.id });
    departmentId = dept.id;

    const rw = await liveWindow();
    const res = await APPLY(
      mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: baseBody(`conv-${uniqueSuffix()}@test.com`),
        headers: { "x-forwarded-for": `10.210.${Math.floor(Math.random() * 50) + 1}.1` },
      }),
      { params: Promise.resolve({ id: rw.id }) }
    );
    const { id: applicantId } = await res.json();

    await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: "ACCEPTED" },
    });

    const convertRes = await CONVERT_POST(
      mockRequest(`/api/applicants/${applicantId}/convert`, { method: "POST", body: {} }),
      { params: Promise.resolve({ id: applicantId }) }
    );
    expect(convertRes.status).toBe(200);
    const converted = await prisma.member.findFirst({
      where: { sourceApplicant: { is: { id: applicantId } } },
    });
    expect(converted).not.toBeNull();
    expect(converted!.joiningDate).toBeInstanceOf(Date);
    expect(converted!.joiningDate.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("Promotion history preservation on approval", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  it("keeps the old role row (soft-ended) and adds the new role row", async () => {
    const { userId: approverId, committeeId } = await setupAdmin(["promotion.approve"]);
    const subjectUser = await createTestUser({ email: `hist-${uniqueSuffix()}@test.com` });
    const subjectMember = await createTestMember({ userId: subjectUser.user.id, status: "ACTIVE" });
    const currentRole = await createTestRole({ name: `HistOld-${uniqueSuffix()}` });
    const proposedRole = await createTestRole({ name: `HistNew-${uniqueSuffix()}` });
    await assignCommitteeRole(subjectMember.id, currentRole.id, committeeId);

    const promo = await prisma.promotionRequest.create({
      data: {
        memberId: subjectMember.id,
        currentRoleId: currentRole.id,
        proposedRoleId: proposedRole.id,
        reason: "history test",
        submittedById: approverId,
        status: "PENDING_APPROVAL",
      },
    });

    const res = await PROMO_DECISION(
      mockRequest(`/api/promotions/${promo.id}/decision`, {
        method: "POST",
        body: { status: "APPROVED" },
      }),
      { params: Promise.resolve({ id: promo.id }) }
    );
    expect(res.status).toBe(200);

    const rows = await prisma.committeeMemberRole.findMany({
      where: { memberId: subjectMember.id, committeeId },
    });
    expect(rows).toHaveLength(2); // old row preserved + new row added

    const oldRow = rows.find((r) => r.roleId === currentRole.id);
    const newRow = rows.find((r) => r.roleId === proposedRole.id);
    expect(oldRow).toBeDefined();
    expect(oldRow!.endedAt).not.toBeNull(); // history soft-ended, not deleted
    expect(newRow).toBeDefined();
    expect(newRow!.endedAt).toBeNull(); // new role is active
  });

  it("rejection does not touch the member's committee roles", async () => {
    const { userId: approverId, committeeId } = await setupAdmin(["promotion.approve"]);
    const subjectUser = await createTestUser({ email: `rej-${uniqueSuffix()}@test.com` });
    const subjectMember = await createTestMember({ userId: subjectUser.user.id, status: "ACTIVE" });
    const currentRole = await createTestRole({ name: `RejOld-${uniqueSuffix()}` });
    const proposedRole = await createTestRole({ name: `RejNew-${uniqueSuffix()}` });
    await assignCommitteeRole(subjectMember.id, currentRole.id, committeeId);

    const promo = await prisma.promotionRequest.create({
      data: {
        memberId: subjectMember.id,
        currentRoleId: currentRole.id,
        proposedRoleId: proposedRole.id,
        reason: "reject test",
        submittedById: approverId,
        status: "PENDING_APPROVAL",
      },
    });

    const res = await PROMO_DECISION(
      mockRequest(`/api/promotions/${promo.id}/decision`, {
        method: "POST",
        body: { status: "REJECTED" },
      }),
      { params: Promise.resolve({ id: promo.id }) }
    );
    expect(res.status).toBe(200);

    const rows = await prisma.committeeMemberRole.findMany({
      where: { memberId: subjectMember.id, committeeId },
    });
    expect(rows).toHaveLength(1); // untouched
    expect(rows[0].roleId).toBe(currentRole.id);
    expect(rows[0].endedAt).toBeNull();
  });
});

describe("Database integrity (raw SQL against real PostgreSQL)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  it("PostgreSQL rejects an invalid RegistrationWindow status value", async () => {
    const rw = await liveWindow();
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "RegistrationWindow" SET status = 'BOGUS' WHERE id = '${rw.id}'`
      )
    ).rejects.toThrow();
  });

  it("PostgreSQL rejects an invalid Applicant status value", async () => {
    const rw = await liveWindow();
    await prisma.applicant.create({
      data: {
        registrationWindowId: rw.id,
        name: "Integrity",
        email: `db-${uniqueSuffix()}@test.com`,
        phone: "123",
        studentId: `S${uniqueSuffix()}`,
        departmentPrefs: [],
      },
    });
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "Applicant" SET status = 'BOGUS' WHERE "registrationWindowId" = '${rw.id}'`
      )
    ).rejects.toThrow();
  });

  it("PostgreSQL rejects an invalid Member status value", async () => {
    const { user } = await createTestUser({ email: `dbm-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: user.id, status: "ACTIVE" });
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "Member" SET status = 'BOGUS' WHERE id = '${member.id}'`
      )
    ).rejects.toThrow();
  });
});
