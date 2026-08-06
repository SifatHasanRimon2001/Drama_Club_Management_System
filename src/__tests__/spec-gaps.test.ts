import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as PROMO_POST } from "@/app/api/promotions/route";
import { POST as SUBMIT } from "@/app/api/promotions/[id]/submit/route";
import { POST as DECISION } from "@/app/api/promotions/[id]/decision/route";
import { POST as RW_POST } from "@/app/api/registration-windows/route";
import { PATCH as RW_PATCH } from "@/app/api/registration-windows/[id]/route";
import { POST as APPLY_POST } from "@/app/api/registration-windows/[id]/apply/route";
import { PATCH as SCOPED_APPLICANT_PATCH } from "@/app/api/registration-windows/[id]/applicants/[applicantId]/route";
import { POST as CONVERT_POST } from "@/app/api/applicants/[id]/convert/route";
import { POST as COMMITTEES_POST } from "@/app/api/committees/route";
import { POST as ROLES_POST } from "@/app/api/roles/route";
import { PATCH as ROLE_PATCH } from "@/app/api/roles/[id]/route";
import { POST as MEMBERS_POST } from "@/app/api/members/route";
import { PATCH as SETTINGS_PATCH } from "@/app/api/settings/route";
import { POST as CONTACT_POST } from "@/app/api/contact/route";
import { POST as GALLERY_ITEM_POST } from "@/app/api/gallery/items/route";
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

const ADMIN_PERMISSIONS = [
  "promotion.submit",
  "promotion.approve",
  "registration.manage",
  "registration.review",
  "member.create",
  "member.edit",
  "permissions.manage",
  "settings.manage",
  "committee.manage",
];

describe("PRD §4 - Promotion for a report", () => {
  let adminUserId: string;
  let committee: { id: string };

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-sponsor-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ADMIN_PERMISSIONS.map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);
    mockAuth(adminUserId, ADMIN_PERMISSIONS);
  });

  async function createReportSetup() {
    const subjectUser = await createTestUser({ email: `report-${uniqueSuffix()}@test.com` });
    const subjectMember = await createTestMember({ userId: subjectUser.user.id, status: "ACTIVE" });
    const currentRole = await createTestRole({ name: `Cur-${uniqueSuffix()}` });
    const proposedRole = await createTestRole({ name: `Prop-${uniqueSuffix()}` });
    await assignCommitteeRole(subjectMember.id, currentRole.id, committee.id);
    return { subjectUser, subjectMember, currentRole, proposedRole };
  }

  it("creates a promotion request for another member, tagged to the authenticated sponsor", async () => {
    const { subjectMember, currentRole, proposedRole } = await createReportSetup();

    const res = await PROMO_POST(
      mockRequest("/api/promotions", {
        method: "POST",
        body: {
          memberId: subjectMember.id,
          currentRoleId: currentRole.id,
          proposedRoleId: proposedRole.id,
          reason: "Excellent leadership on stage",
          achievements: "Led two productions",
          documentUrls: ["https://example.com/portfolio.pdf"],
        },
      })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.status).toBe("DRAFT");
    expect(data.memberId).toBe(subjectMember.id);
    expect(data.submittedById).toBe(adminUserId);
    expect(data.achievements).toBe("Led two productions");
    expect(data.documentUrls).toEqual(["https://example.com/portfolio.pdf"]);
  });

  it("sponsor (submittedById, not the subject member) can submit the promotion", async () => {
    const { subjectMember, currentRole, proposedRole } = await createReportSetup();

    const promo = await prisma.promotionRequest.create({
      data: {
        memberId: subjectMember.id,
        currentRoleId: currentRole.id,
        proposedRoleId: proposedRole.id,
        reason: "Test",
        submittedById: adminUserId,
        status: "DRAFT",
      },
    });

    const res = await SUBMIT(
      mockRequest(`/api/promotions/${promo.id}/submit`, { method: "POST" }),
      { params: Promise.resolve({ id: promo.id }) }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("SUBMITTED");
  });
});

describe("PRD §4 - Promotion decision from PENDING_APPROVAL", () => {
  let adminUserId: string;
  let committee: { id: string };

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-pa-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ["promotion.submit", "promotion.approve"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);
    mockAuth(adminUserId, ["promotion.submit", "promotion.approve"]);
  });

  it("approves a promotion in PENDING_APPROVAL state", async () => {
    const subjectUser = await createTestUser({ email: `subject-pa-${uniqueSuffix()}@test.com` });
    const subjectMember = await createTestMember({ userId: subjectUser.user.id, status: "ACTIVE" });
    const currentRole = await createTestRole({ name: `Cur-${uniqueSuffix()}` });
    const proposedRole = await createTestRole({ name: `Prop-${uniqueSuffix()}` });
    await assignCommitteeRole(subjectMember.id, currentRole.id, committee.id);

    const promo = await prisma.promotionRequest.create({
      data: {
        memberId: subjectMember.id,
        currentRoleId: currentRole.id,
        proposedRoleId: proposedRole.id,
        reason: "Test",
        submittedById: adminUserId,
        status: "PENDING_APPROVAL",
      },
    });

    const res = await DECISION(
      mockRequest(`/api/promotions/${promo.id}/decision`, {
        method: "POST",
        body: { status: "APPROVED" },
      }),
      { params: Promise.resolve({ id: promo.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("APPROVED");

    const newRole = await prisma.committeeMemberRole.findFirst({
      where: { committeeId: committee.id, memberId: subjectMember.id, roleId: proposedRole.id, endedAt: null },
    });
    expect(newRole).not.toBeNull();
  });
});

describe("Scoped applicant route - window isolation", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
    const admin = await createTestUser({ email: `admin-scope-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: admin.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const role = await createTestRole({
      name: "Admin",
      permissionIds: [ (await prisma.permission.findUnique({ where: { key: "registration.review" } }))!.id ],
    });
    await assignCommitteeRole(member.id, role.id, committee.id);
    mockAuth(admin.user.id, ["registration.review"]);
  });

  it("returns 404 when the applicant belongs to a different window", async () => {
    const windowA = await prisma.registrationWindow.create({
      data: { title: "A", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    const windowB = await prisma.registrationWindow.create({
      data: { title: "B", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
    const applicant = await prisma.applicant.create({
      data: {
        registrationWindowId: windowA.id,
        name: "Mismatch",
        email: `mm-${uniqueSuffix()}@test.com`,
        phone: "1",
        studentId: "S",
        departmentPrefs: [],
        skills: [],
        status: "SUBMITTED",
      },
    });

    const res = await SCOPED_APPLICANT_PATCH(
      mockRequest(`/api/registration-windows/${windowB.id}/applicants/${applicant.id}`, {
        method: "PATCH",
        body: { status: "ACCEPTED" },
      }),
      { params: Promise.resolve({ id: windowB.id, applicantId: applicant.id }) }
    );
    expect(res.status).toBe(404);

    const untouched = await prisma.applicant.findUnique({ where: { id: applicant.id } });
    expect(untouched!.status).toBe("SUBMITTED");
  });
});

describe("PRD §7 - Audit trail for mandated actions", () => {
  let adminUserId: string;
  let committee: { id: string };

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-aud2-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    committee = await createTestCommittee({ isCurrent: true });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ADMIN_PERMISSIONS.map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);
    mockAuth(adminUserId, ADMIN_PERMISSIONS);
  });

  async function expectAudit(action: string, actorId?: string) {
    const log = await prisma.auditLog.findFirst({
      where: { action, ...(actorId ? { actorId } : {}) },
    });
    expect(log, `expected audit entry for ${action}`).not.toBeNull();
    return log!;
  }

  async function createLiveWindow() {
    return prisma.registrationWindow.create({
      data: { title: "W", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
    });
  }

  it("audits application submission (public actor)", async () => {
    const window = await createLiveWindow();
    const dept = await prisma.department.create({
      data: { name: `Dept-${uniqueSuffix()}`, committeeId: committee.id },
    });
    const res = await APPLY_POST(
      mockRequest(`/api/registration-windows/${window.id}/apply`, {
        method: "POST",
        body: {
          name: "Applicant",
          email: `aud-app-${uniqueSuffix()}@test.com`,
          phone: "1",
          studentId: "S",
          departmentPrefs: [dept.id],
          skills: [],
        },
        headers: { "x-forwarded-for": `50.1.${Math.floor(Math.random() * 200) + 1}.1` },
      }),
      { params: Promise.resolve({ id: window.id }) }
    );
    expect(res.status).toBe(201);
    const audit = await expectAudit("applicant.submitted", "public");
    expect(audit.entityType).toBe("Applicant");
  });

  it("audits applicant accept with metadata", async () => {
    const window = await createLiveWindow();
    const applicant = await prisma.applicant.create({
      data: {
        registrationWindowId: window.id,
        name: "A",
        email: `aud-acc-${uniqueSuffix()}@test.com`,
        phone: "1",
        studentId: "S",
        departmentPrefs: [],
        skills: [],
        status: "SUBMITTED",
      },
    });

    const res = await SCOPED_APPLICANT_PATCH(
      mockRequest(`/api/registration-windows/${window.id}/applicants/${applicant.id}`, {
        method: "PATCH",
        body: { status: "ACCEPTED" },
      }),
      { params: Promise.resolve({ id: window.id, applicantId: applicant.id }) }
    );
    expect(res.status).toBe(200);

    const audit = await expectAudit("applicant.accepted", adminUserId);
    expect(audit.entityId).toBe(applicant.id);
    expect((audit.metadata as Record<string, unknown>).newStatus).toBe("ACCEPTED");
  });

  it("audits applicant conversion", async () => {
    const window = await createLiveWindow();
    const applicant = await prisma.applicant.create({
      data: {
        registrationWindowId: window.id,
        name: "Convert Me",
        email: `aud-conv-${uniqueSuffix()}@test.com`,
        phone: "1",
        studentId: "S",
        departmentPrefs: [],
        skills: [],
        status: "ACCEPTED",
      },
    });

    const res = await CONVERT_POST(
      mockRequest(`/api/applicants/${applicant.id}/convert`, { method: "POST", body: {} }),
      { params: Promise.resolve({ id: applicant.id }) }
    );
    expect(res.status).toBe(200);

    const audit = await expectAudit("applicant.converted", adminUserId);
    expect(audit.entityId).toBe(applicant.id);
  });

  it("audits promotion creation, submission, approval and rejection", async () => {
    const subjectUser = await createTestUser({ email: `aud-promo-${uniqueSuffix()}@test.com` });
    const subjectMember = await createTestMember({ userId: subjectUser.user.id, status: "ACTIVE" });
    const currentRole = await createTestRole({ name: `Cur-${uniqueSuffix()}` });
    const proposedRole = await createTestRole({ name: `Prop-${uniqueSuffix()}` });
    await assignCommitteeRole(subjectMember.id, currentRole.id, committee.id);

    const createRes = await PROMO_POST(
      mockRequest("/api/promotions", {
        method: "POST",
        body: {
          memberId: subjectMember.id,
          currentRoleId: currentRole.id,
          proposedRoleId: proposedRole.id,
          reason: "Audit reason",
        },
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    await expectAudit("promotion.created", adminUserId);

    const submitRes = await SUBMIT(
      mockRequest(`/api/promotions/${created.id}/submit`, { method: "POST" }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(submitRes.status).toBe(200);
    await expectAudit("promotion.submitted", adminUserId);

    const approveRes = await DECISION(
      mockRequest(`/api/promotions/${created.id}/decision`, {
        method: "POST",
        body: { status: "APPROVED" },
      }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(approveRes.status).toBe(200);
    await expectAudit("promotion.approved", adminUserId);

    const subjectUser2 = await createTestUser({ email: `aud-promo2-${uniqueSuffix()}@test.com` });
    const subjectMember2 = await createTestMember({ userId: subjectUser2.user.id, status: "ACTIVE" });
    await assignCommitteeRole(subjectMember2.id, currentRole.id, committee.id);

    const promo2 = await prisma.promotionRequest.create({
      data: {
        memberId: subjectMember2.id,
        currentRoleId: currentRole.id,
        proposedRoleId: proposedRole.id,
        reason: "Audit rejection",
        submittedById: adminUserId,
        status: "SUBMITTED",
      },
    });

    const rejectRes = await DECISION(
      mockRequest(`/api/promotions/${promo2.id}/decision`, {
        method: "POST",
        body: { status: "REJECTED" },
      }),
      { params: Promise.resolve({ id: promo2.id }) }
    );
    expect(rejectRes.status).toBe(200);
    await expectAudit("promotion.rejected", adminUserId);
  });

  it("audits committee creation", async () => {
    const res = await COMMITTEES_POST(
      mockRequest("/api/committees", {
        method: "POST",
        body: {
          year: "2031-2032",
          startDate: "2031-01-01T00:00:00.000Z",
          endDate: "2031-12-31T00:00:00.000Z",
          isCurrent: true,
        },
      })
    );
    expect(res.status).toBe(201);
    await expectAudit("committee.created", adminUserId);
  });

  it("audits role creation and update", async () => {
    const createRes = await ROLES_POST(
      mockRequest("/api/roles", {
        method: "POST",
        body: { name: `AuditRole${uniqueSuffix()}`, description: "desc" },
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    await expectAudit("role.created", adminUserId);

    const patchRes = await ROLE_PATCH(
      mockRequest(`/api/roles/${created.id}`, {
        method: "PATCH",
        body: { name: `AuditRoleRenamed${uniqueSuffix()}` },
      }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(patchRes.status).toBe(200);
    await expectAudit("role.updated", adminUserId);
  });

  it("audits registration window creation and update", async () => {
    const createRes = await RW_POST(
      mockRequest("/api/registration-windows", {
        method: "POST",
        body: {
          title: `AuditRW${uniqueSuffix()}`,
          description: "desc",
          startDate: "2025-01-01T00:00:00.000Z",
          endDate: "2025-06-01T00:00:00.000Z",
        },
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    await expectAudit("registration_window.created", adminUserId);

    const patchRes = await RW_PATCH(
      mockRequest(`/api/registration-windows/${created.id}`, {
        method: "PATCH",
        body: { title: `AuditRWUpdated${uniqueSuffix()}` },
      }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(patchRes.status).toBe(200);
    await expectAudit("registration_window.updated", adminUserId);
  });

  it("audits member creation", async () => {
    const freshUser = await createTestUser({ email: `aud-member-${uniqueSuffix()}@test.com` });
    const res = await MEMBERS_POST(
      mockRequest("/api/members", {
        method: "POST",
        body: { userId: freshUser.user.id, memberCode: `AUD-${uniqueSuffix()}` },
      })
    );
    expect(res.status).toBe(201);
    await expectAudit("member.created", adminUserId);
  });

  it("audits settings update", async () => {
    const res = await SETTINGS_PATCH(
      mockRequest("/api/settings", {
        method: "PATCH",
        body: { clubName: `Audit Club ${uniqueSuffix()}` },
      })
    );
    expect(res.status).toBe(200);
    await expectAudit("settings.updated", adminUserId);
  });

  it("audits contact submission", async () => {
    const res = await CONTACT_POST(
      mockRequest("/api/contact", {
        method: "POST",
        body: {
          name: "Audit Contact",
          email: `aud-contact-${uniqueSuffix()}@test.com`,
          message: "A message long enough to be valid",
        },
        headers: { "x-forwarded-for": `51.2.${Math.floor(Math.random() * 200) + 1}.1` },
      })
    );
    expect(res.status).toBe(201);
    await expectAudit("contact.submitted", "public");
  });
});

describe("PRD §3c - Gallery upload notifications", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
    const admin = await createTestUser({ email: `admin-gal-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: admin.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const role = await createTestRole({
      name: "Admin",
      permissionIds: [ (await prisma.permission.findUnique({ where: { key: "gallery.upload" } }))!.id ],
    });
    await assignCommitteeRole(member.id, role.id, committee.id);
    mockAuth(admin.user.id, ["gallery.upload"]);
  });

  async function enableRealNotifications() {
    const real = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
    const { notifyDepartmentMembers } = await import("@/lib/notifications");
    vi.mocked(notifyDepartmentMembers).mockImplementation(real.notifyDepartmentMembers);
  }

  it("does not notify anyone for uploads to albums without a department", async () => {
    await enableRealNotifications();
    const album = await prisma.galleryAlbum.create({
      data: { name: "General", category: "CLUB_LIFE" },
    });

    const res = await GALLERY_ITEM_POST(
      mockRequest("/api/gallery/items", {
        method: "POST",
        body: {
          albumId: album.id,
          r2Key: "general/photo.jpg",
          fileName: "photo.jpg",
          type: "IMAGE",
        },
      })
    );
    expect(res.status).toBe(201);

    const notifications = await prisma.notification.count();
    expect(notifications).toBe(0);
  });

  it("notifies department members for uploads to a department album", async () => {
    await enableRealNotifications();
    const committee = await createTestCommittee({ isCurrent: true });
    const dept = await prisma.department.create({
      data: { name: `Dept-${uniqueSuffix()}`, committeeId: committee.id },
    });
    const deptMemberUser = await createTestUser({ email: `deptmem-${uniqueSuffix()}@test.com` });
    await createTestMember({ userId: deptMemberUser.user.id, status: "ACTIVE" });
    const deptMember = await prisma.member.findFirst({ where: { userId: deptMemberUser.user.id } });
    await prisma.memberDepartment.create({
      data: { memberId: deptMember!.id, departmentId: dept.id },
    });

    const album = await prisma.galleryAlbum.create({
      data: { name: "Dept Album", category: "PRODUCTIONS", departmentId: dept.id },
    });

    const res = await GALLERY_ITEM_POST(
      mockRequest("/api/gallery/items", {
        method: "POST",
        body: {
          albumId: album.id,
          r2Key: "dept/photo.jpg",
          fileName: "photo.jpg",
          type: "IMAGE",
        },
      })
    );
    expect(res.status).toBe(201);

    const notifications = await prisma.notification.findMany({
      where: { userId: deptMemberUser.user.id, type: "GALLERY" },
    });
    expect(notifications.length).toBe(1);
    expect(notifications[0].payload).toMatchObject({ albumId: album.id });
  });
});
