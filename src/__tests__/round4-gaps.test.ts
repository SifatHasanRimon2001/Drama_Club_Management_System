import { describe, it, expect, beforeEach } from "vitest";
import { PATCH as APPLICANT_PATCH } from "@/app/api/applicants/[id]/route";
import { POST as CONVERT_POST } from "@/app/api/applicants/[id]/convert/route";
import { POST as APPLY_POST } from "@/app/api/registration-windows/[id]/apply/route";
import { GET as WINDOW_APPLICANTS_GET } from "@/app/api/registration-windows/[id]/applicants/route";
import { POST as RW_POST } from "@/app/api/registration-windows/route";
import { PATCH as RW_PATCH } from "@/app/api/registration-windows/[id]/route";
import { GET as RW_GET_ONE } from "@/app/api/registration-windows/[id]/route";
import { POST as NOTIF_READ } from "@/app/api/notifications/[id]/read/route";
import { POST as CONTACT_POST } from "@/app/api/contact/route";
import { PATCH as ROLE_PATCH } from "@/app/api/roles/[id]/route";
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
  getTestPermission,
  uniqueSuffix,
} from "./helpers";
import prisma from "@/lib/prisma";

const REVIEW_PERMS = ["registration.review", "registration.manage", "member.create"];

async function setupAdmin(perms: string[]) {
  await seedPermissions();
  const { user } = await createTestUser({ email: `admin-r4-${uniqueSuffix()}@test.com` });
  const member = await createTestMember({ userId: user.id, status: "ACTIVE" });
  const committee = await createTestCommittee({ isCurrent: true });
  const role = await createTestRole({
    name: "Round4Admin",
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
  return user.id;
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

async function createLiveWindow() {
  const res = await RW_POST(
    mockRequest("/api/registration-windows", { method: "POST", body: liveWindowBody() })
  );
  return res.json();
}

async function submitApplicant(windowId: string, departmentId: string, name: string) {
  clearAuth();
  const octet = (testCounterRaw: string) => {
    let hash = 0;
    for (const ch of testCounterRaw) hash = (hash * 31 + ch.charCodeAt(0)) % 200;
    return hash + 10;
  };
  const ip = `10.1.${octet(uniqueSuffix())}.${octet(name)}`;
  return APPLY_POST(
    mockRequest(`/api/registration-windows/${windowId}/apply`, {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: {
        name,
        email: `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${uniqueSuffix()}@test.com`,
        phone: "1234567890",
        studentId: `S-${uniqueSuffix()}`,
        departmentPrefs: [departmentId],
        skills: ["acting"],
      },
    }),
    { params: Promise.resolve({ id: windowId }) }
  );
}

describe("Applicant state machine — remaining blocked transitions", () => {
  let adminUserId: string;
  let departmentId: string;

  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    adminUserId = await setupAdmin(REVIEW_PERMS);
    const committee = await createTestCommittee({ isCurrent: true });
    departmentId = (await createTestDepartment({ committeeId: committee.id })).id;
  });

  it("blocks ACCEPTED -> REJECTED on the unscoped route", async () => {
    const window = await createLiveWindow();
    const applied = await submitApplicant(window.id, departmentId, "AcceptedThenRejected");
    expect(applied.status).toBe(201);
    const applicant = await applied.json();

    mockAuth(adminUserId, REVIEW_PERMS);
    const accepted = await APPLICANT_PATCH(
      mockRequest(`/api/applicants/${applicant.id}`, {
        method: "PATCH",
        body: { status: "ACCEPTED" },
      }),
      { params: Promise.resolve({ id: applicant.id }) }
    );
    expect(accepted.status).toBe(200);

    const rejected = await APPLICANT_PATCH(
      mockRequest(`/api/applicants/${applicant.id}`, {
        method: "PATCH",
        body: { status: "REJECTED" },
      }),
      { params: Promise.resolve({ id: applicant.id }) }
    );
    expect(rejected.status).toBe(400);

    const dbApplicant = await prisma.applicant.findUnique({ where: { id: applicant.id } });
    expect(dbApplicant!.status).toBe("ACCEPTED");
  });

  it("blocks any further decision on a CONVERTED applicant", async () => {
    const window = await createLiveWindow();
    const applied = await submitApplicant(window.id, departmentId, "ConvertThenBlock");
    expect(applied.status).toBe(201);
    const applicant = await applied.json();

    mockAuth(adminUserId, REVIEW_PERMS);
    const accepted = await APPLICANT_PATCH(
      mockRequest(`/api/applicants/${applicant.id}`, {
        method: "PATCH",
        body: { status: "ACCEPTED" },
      }),
      { params: Promise.resolve({ id: applicant.id }) }
    );
    expect(accepted.status).toBe(200);

    const converted = await CONVERT_POST(
      mockRequest(`/api/applicants/${applicant.id}/convert`, { method: "POST", body: {} }),
      { params: Promise.resolve({ id: applicant.id }) }
    );
    expect(converted.status).toBe(200);

    const postConvert = await APPLICANT_PATCH(
      mockRequest(`/api/applicants/${applicant.id}`, {
        method: "PATCH",
        body: { status: "REJECTED" },
      }),
      { params: Promise.resolve({ id: applicant.id }) }
    );
    expect(postConvert.status).toBe(400);

    const dbApplicant = await prisma.applicant.findUnique({ where: { id: applicant.id } });
    expect(dbApplicant!.status).toBe("CONVERTED");
    expect(dbApplicant!.convertedMemberId).not.toBeNull();
  });
});

describe("Registration window — scoped applicant list isolation", () => {
  let adminUserId: string;
  let departmentId: string;

  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    adminUserId = await setupAdmin(REVIEW_PERMS);
    const committee = await createTestCommittee({ isCurrent: true });
    departmentId = (await createTestDepartment({ committeeId: committee.id })).id;
  });

  it("returns only applicants belonging to the requested window", async () => {
    const windowA = await createLiveWindow();
    const windowB = await createLiveWindow();

    await submitApplicant(windowA.id, departmentId, "WindowOne");
    await submitApplicant(windowA.id, departmentId, "WindowOne2");
    await submitApplicant(windowB.id, departmentId, "WindowTwo");

    mockAuth(adminUserId, REVIEW_PERMS);
    const res = await WINDOW_APPLICANTS_GET(
      mockRequest(`/api/registration-windows/${windowA.id}/applicants`),
      { params: Promise.resolve({ id: windowA.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    const applicants = data.applicants;
    expect(applicants).toHaveLength(2);
    for (const a of applicants) {
      expect(a.registrationWindowId).toBe(windowA.id);
    }
  });
});

describe("Notification — read idempotency", () => {
  let userId: string;

  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    const { user } = await createTestUser({ email: `notif-r4-${uniqueSuffix()}@test.com` });
    userId = user.id;
  });

  it("marking an already-read notification again succeeds and keeps readAt", async () => {
    const notification = await prisma.notification.create({
      data: { userId, type: "EVENT", title: "Idempotent", message: "test", payload: {} },
    });

    mockAuth(userId, []);
    const first = await NOTIF_READ(
      mockRequest(`/api/notifications/${notification.id}/read`, { method: "POST" }),
      { params: Promise.resolve({ id: notification.id }) }
    );
    expect(first.status).toBe(200);

    const second = await NOTIF_READ(
      mockRequest(`/api/notifications/${notification.id}/read`, { method: "POST" }),
      { params: Promise.resolve({ id: notification.id }) }
    );
    expect(second.status).toBe(200);

    const dbNotification = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(dbNotification!.readAt).not.toBeNull();
  });
});

describe("Registration window PATCH — description and bannerUrl", () => {
  let adminUserId: string;

  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    adminUserId = await setupAdmin(["registration.manage"]);
  });

  it("updates description and bannerUrl", async () => {
    const window = await createLiveWindow();
    const newDescription = `Updated description ${uniqueSuffix()}`;
    const banner = "https://example.com/banner.jpg";

    mockAuth(adminUserId, ["registration.manage"]);
    const res = await RW_PATCH(
      mockRequest(`/api/registration-windows/${window.id}`, {
        method: "PATCH",
        body: { description: newDescription, bannerUrl: banner },
      }),
      { params: Promise.resolve({ id: window.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBe(newDescription);
    expect(data.bannerUrl).toBe(banner);

    const fetched = await RW_GET_ONE(
      mockRequest(`/api/registration-windows/${window.id}`),
      { params: Promise.resolve({ id: window.id }) }
    );
    const fetchedData = await fetched.json();
    expect(fetchedData.description).toBe(newDescription);
    expect(fetchedData.bannerUrl).toBe(banner);
  });
});

describe("Contact — stored submission shape", () => {
  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
  });

  it("persists contact with handledAt null", async () => {
    const res = await CONTACT_POST(
      mockRequest("/api/contact", {
        method: "POST",
        headers: { "x-forwarded-for": `10.9.${uniqueSuffix().slice(0, 3)}.1` },
        body: {
          name: "Contact Tester",
          email: `contact-${uniqueSuffix()}@test.com`,
          message: "A sufficiently long message for validation",
        },
      })
    );
    expect(res.status).toBe(201);

    const submission = await prisma.contactSubmission.findFirst({
      where: { name: "Contact Tester" },
      orderBy: { createdAt: "desc" },
    });
    expect(submission).not.toBeNull();
    expect(submission!.handledAt).toBeNull();
    expect(submission!.message.length).toBeGreaterThan(0);
  });
});

describe("Role PATCH — permission replacement verified in DB", () => {
  beforeEach(async () => {
    await cleanupTestData();
    clearAuth();
    await setupAdmin(["permissions.manage"]);
  });

  it("replaces permission links atomically at the join-table level", async () => {
    const permA = (await getTestPermission("member.view"))!;
    const permB = (await getTestPermission("member.edit"))!;
    const permC = (await getTestPermission("events.manage"))!;

    const { POST: ROLES_POST } = await import("@/app/api/roles/route");
    const created = await ROLES_POST(
      mockRequest("/api/roles", {
        method: "POST",
        body: { name: `JoinRole-${uniqueSuffix()}`, permissionIds: [permA.id, permB.id] },
      })
    );
    expect(created.status).toBe(201);
    const role = await created.json();
    expect(
      await prisma.rolePermission.count({ where: { roleId: role.id } })
    ).toBe(2);

    const patched = await ROLE_PATCH(
      mockRequest(`/api/roles/${role.id}`, {
        method: "PATCH",
        body: { permissionIds: [permC.id] },
      }),
      { params: Promise.resolve({ id: role.id }) }
    );
    expect(patched.status).toBe(200);

    const links = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
    });
    expect(links).toHaveLength(1);
    expect(links[0].permissionId).toBe(permC.id);
  });
});
