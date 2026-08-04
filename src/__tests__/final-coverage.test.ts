import { describe, it, expect, beforeEach } from "vitest";
import { GET as RW_APPLICANTS_GET } from "@/app/api/registration-windows/[id]/applicants/route";
import { PATCH as RW_APPLICANT_PATCH } from "@/app/api/registration-windows/[id]/applicants/[applicantId]/route";
import { GET as COMMITTEE_GET, PATCH as COMMITTEE_PATCH } from "@/app/api/committees/[id]/route";
import { GET as APPLICANT_GET, PATCH as APPLICANT_PATCH } from "@/app/api/applicants/[id]/route";
import { POST as CONVERT_POST } from "@/app/api/applicants/[id]/convert/route";
import { POST as PROMO_SUBMIT } from "@/app/api/promotions/[id]/submit/route";
import { POST as PROMO_DECISION } from "@/app/api/promotions/[id]/decision/route";
import { GET as EVENT_GET, PATCH as EVENT_PATCH } from "@/app/api/events/[id]/route";
import { POST as ITEMS_POST } from "@/app/api/gallery/items/route";
import { GET as NOTIFS_GET } from "@/app/api/notifications/route";
import { POST as APPLY_POST } from "@/app/api/registration-windows/[id]/apply/route";
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
  uniqueSuffix,
  NON_EXISTENT_CUID,
} from "./helpers";
import prisma from "@/lib/prisma";

describe("Final Coverage Gaps", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  async function setupAdmin(extraPerms: string[] = []) {
    const allPerms = [...new Set(["member.view", "member.create", "member.edit", "department.view", "department.manage", "committee.manage", "registration.manage", "registration.review", "promotion.submit", "promotion.approve", "gallery.upload", "gallery.manage", "updates.publish", "events.manage", "permissions.manage", "settings.manage", ...extraPerms])];
    const user = await createTestUser({ email: `admin-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const role = await createTestRole({ name: `Admin-${uniqueSuffix()}`, permissionIds: (await Promise.all(allPerms.map(async k => { const p = await prisma.permission.findUnique({ where: { key: k } }); return p!.id; }))) });
    await assignCommitteeRole(member.id, role.id, committee.id);
    mockAuth(user.user.id, allPerms);
    return { user, member, committee };
  }

  async function setupUserWithPerms(perms: string[]) {
    const user = await createTestUser({ email: `user-${uniqueSuffix()}@test.com` });
    const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
    const committee = await createTestCommittee({ isCurrent: true });
    const role = await createTestRole({ name: `Role-${uniqueSuffix()}`, permissionIds: (await Promise.all(perms.map(async k => { const p = await prisma.permission.findUnique({ where: { key: k } }); return p!.id; }))) });
    await assignCommitteeRole(member.id, role.id, committee.id);
    return { user, member, committee, role };
  }

  describe("Missing Auth Tests", () => {
    it("PATCH /api/committees/:id returns 403 without committee.manage", async () => {
      const { user } = await setupUserWithPerms([]);
      const committee = await createTestCommittee();
      mockAuth(user.user.id, []);
      const res = await COMMITTEE_PATCH(
        mockRequest(`/api/committees/${committee.id}`, { method: "PATCH", body: { status: "DISSOLVED" } }),
        { params: Promise.resolve({ id: committee.id }) }
      );
      expect(res.status).toBe(403);
    });

    it("GET /api/registration-windows/:id/applicants returns 401 unauthenticated", async () => {
      clearAuth();
      const res = await RW_APPLICANTS_GET(
        mockRequest(`/api/registration-windows/${NON_EXISTENT_CUID}/applicants`),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(401);
    });

    it("GET /api/registration-windows/:id/applicants returns 403 without registration.review", async () => {
      const { user } = await setupUserWithPerms([]);
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "DRAFT", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      mockAuth(user.user.id, []);
      const res = await RW_APPLICANTS_GET(
        mockRequest(`/api/registration-windows/${rw.id}/applicants`),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(403);
    });

    it("PATCH /api/registration-windows/:id/applicants/:applicantId returns 401 unauthenticated", async () => {
      clearAuth();
      const res = await RW_APPLICANT_PATCH(
        mockRequest(`/api/registration-windows/${NON_EXISTENT_CUID}/applicants/${NON_EXISTENT_CUID}`, { method: "PATCH", body: { status: "ACCEPTED" } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID, applicantId: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(401);
    });

    it("PATCH /api/registration-windows/:id/applicants/:applicantId returns 403 without registration.review", async () => {
      const { user } = await setupUserWithPerms([]);
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "SUBMITTED" } });
      mockAuth(user.user.id, []);
      const res = await RW_APPLICANT_PATCH(
        mockRequest(`/api/registration-windows/${rw.id}/applicants/${applicant.id}`, { method: "PATCH", body: { status: "ACCEPTED" } }),
        { params: Promise.resolve({ id: rw.id, applicantId: applicant.id }) }
      );
      expect(res.status).toBe(403);
    });

    it("PATCH /api/applicants/:id returns 401 unauthenticated", async () => {
      clearAuth();
      const res = await APPLICANT_PATCH(
        mockRequest(`/api/applicants/${NON_EXISTENT_CUID}`, { method: "PATCH", body: { status: "ACCEPTED" } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(401);
    });

    it("PATCH /api/applicants/:id returns 403 without registration.review", async () => {
      const { user } = await setupUserWithPerms([]);
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "SUBMITTED" } });
      mockAuth(user.user.id, []);
      const res = await APPLICANT_PATCH(
        mockRequest(`/api/applicants/${applicant.id}`, { method: "PATCH", body: { status: "ACCEPTED" } }),
        { params: Promise.resolve({ id: applicant.id }) }
      );
      expect(res.status).toBe(403);
    });

    it("POST /api/applicants/:id/convert returns 401 unauthenticated", async () => {
      clearAuth();
      const res = await CONVERT_POST(
        mockRequest(`/api/applicants/${NON_EXISTENT_CUID}/convert`, { method: "POST" }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(401);
    });

    it("POST /api/promotions/:id/submit returns 401 unauthenticated", async () => {
      clearAuth();
      const res = await PROMO_SUBMIT(
        mockRequest(`/api/promotions/${NON_EXISTENT_CUID}/submit`, { method: "POST" }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(401);
    });

    it("POST /api/promotions/:id/decision returns 401 unauthenticated", async () => {
      clearAuth();
      const res = await PROMO_DECISION(
        mockRequest(`/api/promotions/${NON_EXISTENT_CUID}/decision`, { method: "POST", body: { decision: "APPROVED" } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(401);
    });

    it("PATCH /api/events/:id returns 401 unauthenticated", async () => {
      clearAuth();
      const res = await EVENT_PATCH(
        mockRequest(`/api/events/${NON_EXISTENT_CUID}`, { method: "PATCH", body: { title: "New" } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(401);
    });

    it("PATCH /api/events/:id returns 403 without events.manage", async () => {
      const { user } = await setupUserWithPerms([]);
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "DRAFT" } });
      mockAuth(user.user.id, []);
      const res = await EVENT_PATCH(
        mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { title: "New" } }),
        { params: Promise.resolve({ id: ev.id }) }
      );
      expect(res.status).toBe(403);
    });

    it("POST /api/gallery/items returns 401 unauthenticated", async () => {
      clearAuth();
      const res = await ITEMS_POST(
        mockRequest("/api/gallery/items", { method: "POST", body: { albumId: "x", r2Key: "y", fileName: "z", type: "IMAGE" } })
      );
      expect(res.status).toBe(401);
    });
  });

  describe("Enum Value Coverage", () => {
    it("ClubUpdate with PRODUCTION category", async () => {
      const { user } = await setupAdmin();
      const update = await prisma.clubUpdate.create({ data: { title: `Upd${uniqueSuffix()}`, bodyRichText: "<p>Body</p>", category: "PRODUCTION", authorId: user.user.id } });
      expect(update.category).toBe("PRODUCTION");
    });

    it("ClubUpdate with RECRUITMENT category", async () => {
      const { user } = await setupAdmin();
      const update = await prisma.clubUpdate.create({ data: { title: `Upd${uniqueSuffix()}`, bodyRichText: "<p>Body</p>", category: "RECRUITMENT", authorId: user.user.id } });
      expect(update.category).toBe("RECRUITMENT");
    });

    it("ClubUpdate with EVENT category", async () => {
      const { user } = await setupAdmin();
      const update = await prisma.clubUpdate.create({ data: { title: `Upd${uniqueSuffix()}`, bodyRichText: "<p>Body</p>", category: "EVENT", authorId: user.user.id } });
      expect(update.category).toBe("EVENT");
    });

    it("Event with FESTIVAL type", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "FESTIVAL", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "DRAFT" } });
      expect(ev.type).toBe("FESTIVAL");
    });

    it("Event with TRAINING type", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "TRAINING", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "DRAFT" } });
      expect(ev.type).toBe("TRAINING");
    });

    it("GalleryItem with VIDEO type", async () => {
      const { user, committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const album = await prisma.galleryAlbum.create({ data: { name: `Album${uniqueSuffix()}`, category: "PRODUCTIONS", departmentId: dept.id } });
      const item = await prisma.galleryItem.create({ data: { albumId: album.id, r2Key: `vid-${uniqueSuffix()}.mp4`, fileName: "video.mp4", type: "VIDEO", uploadedById: user.user.id } });
      expect(item.type).toBe("VIDEO");
    });

    it("Committee with DISSOLVED status", async () => {
      const committee = await createTestCommittee({ status: "DISSOLVED" });
      expect(committee.status).toBe("DISSOLVED");
    });

    it("Committee with UPCOMING status", async () => {
      const committee = await createTestCommittee({ status: "UPCOMING" });
      expect(committee.status).toBe("UPCOMING");
    });

    it("PromotionRequest with PENDING_APPROVAL status", async () => {
      const { member } = await setupAdmin();
      const role = await createTestRole();
      const { user } = await setupAdmin();
      const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: role.id, reason: "Test reason", submittedById: user.user.id, status: "PENDING_APPROVAL" } });
      expect(promo.status).toBe("PENDING_APPROVAL");
    });

    it("Notification with PROMOTION type", async () => {
      const { user } = await setupAdmin();
      const notif = await prisma.notification.create({ data: { userId: user.user.id, type: "PROMOTION", title: "Promo notif", message: "Test" } });
      expect(notif.type).toBe("PROMOTION");
    });

    it("Notification with REGISTRATION type", async () => {
      const { user } = await setupAdmin();
      const notif = await prisma.notification.create({ data: { userId: user.user.id, type: "REGISTRATION", title: "Reg notif", message: "Test" } });
      expect(notif.type).toBe("REGISTRATION");
    });

    it("Notification with ANNOUNCEMENT type", async () => {
      const { user } = await setupAdmin();
      const notif = await prisma.notification.create({ data: { userId: user.user.id, type: "ANNOUNCEMENT", title: "Ann notif", message: "Test" } });
      expect(notif.type).toBe("ANNOUNCEMENT");
    });

    it("Notification with GALLERY type", async () => {
      const { user } = await setupAdmin();
      const notif = await prisma.notification.create({ data: { userId: user.user.id, type: "GALLERY", title: "Gallery notif", message: "Test" } });
      expect(notif.type).toBe("GALLERY");
    });
  });

  describe("Missing State Machine Transitions", () => {
    it("PromotionStatus: APPROVED -> REJECTED is invalid", async () => {
      const { user: approver } = await setupUserWithPerms(["promotion.approve"]);
      const { user: memberUser, member } = await setupUserWithPerms([]);
      const role = await createTestRole();
      const newRole = await createTestRole();
      const currentCommittee = await prisma.committee.findFirst({ where: { isCurrent: true } });
      await assignCommitteeRole(member.id, role.id, currentCommittee!.id);
      const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: newRole.id, reason: "Test reason", submittedById: memberUser.user.id, status: "APPROVED" } });
      mockAuth(approver.user.id, ["promotion.approve"]);
      const res = await PROMO_DECISION(
        mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "REJECTED" } }),
        { params: Promise.resolve({ id: promo.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("PromotionStatus: REJECTED -> APPROVED is invalid", async () => {
      const { user: approver } = await setupUserWithPerms(["promotion.approve"]);
      const { user: memberUser, member } = await setupUserWithPerms([]);
      const role = await createTestRole();
      const newRole = await createTestRole();
      const currentCommittee = await prisma.committee.findFirst({ where: { isCurrent: true } });
      await assignCommitteeRole(member.id, role.id, currentCommittee!.id);
      const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: newRole.id, reason: "Test reason", submittedById: memberUser.user.id, status: "REJECTED" } });
      mockAuth(approver.user.id, ["promotion.approve"]);
      const res = await PROMO_DECISION(
        mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
        { params: Promise.resolve({ id: promo.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("PromotionStatus: DRAFT -> APPROVED is invalid (must go through submit)", async () => {
      const { user: approver } = await setupUserWithPerms(["promotion.approve"]);
      const { user: memberUser, member } = await setupUserWithPerms([]);
      const role = await createTestRole();
      const newRole = await createTestRole();
      const currentCommittee = await prisma.committee.findFirst({ where: { isCurrent: true } });
      await assignCommitteeRole(member.id, role.id, currentCommittee!.id);
      const promo = await prisma.promotionRequest.create({ data: { memberId: member.id, currentRoleId: role.id, proposedRoleId: newRole.id, reason: "Test reason", submittedById: memberUser.user.id, status: "DRAFT" } });
      mockAuth(approver.user.id, ["promotion.approve"]);
      const res = await PROMO_DECISION(
        mockRequest(`/api/promotions/${promo.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
        { params: Promise.resolve({ id: promo.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("ApplicantStatus: SUBMITTED -> REJECTED is valid", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "SUBMITTED" } });
      const res = await APPLICANT_PATCH(
        mockRequest(`/api/applicants/${applicant.id}`, { method: "PATCH", body: { status: "REJECTED" } }),
        { params: Promise.resolve({ id: applicant.id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("REJECTED");
    });

    it("MemberStatus: PENDING -> ACTIVE via PATCH", async () => {
      const { member } = await setupAdmin();
      await prisma.member.update({ where: { id: member.id }, data: { status: "PENDING" } });
      const { PATCH: MEMBER_PATCH } = await import("@/app/api/members/[id]/route");
      const res = await MEMBER_PATCH(
        mockRequest(`/api/members/${member.id}`, { method: "PATCH", body: { status: "ACTIVE" } }),
        { params: Promise.resolve({ id: member.id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ACTIVE");
    });

    it("MemberStatus: ACTIVE -> INACTIVE via PATCH", async () => {
      const { member } = await setupAdmin();
      const { PATCH: MEMBER_PATCH } = await import("@/app/api/members/[id]/route");
      const res = await MEMBER_PATCH(
        mockRequest(`/api/members/${member.id}`, { method: "PATCH", body: { status: "INACTIVE" } }),
        { params: Promise.resolve({ id: member.id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("INACTIVE");
    });

    it("MemberStatus: INACTIVE -> ACTIVE via PATCH", async () => {
      const { member } = await setupAdmin();
      await prisma.member.update({ where: { id: member.id }, data: { status: "INACTIVE" } });
      const { PATCH: MEMBER_PATCH } = await import("@/app/api/members/[id]/route");
      const res = await MEMBER_PATCH(
        mockRequest(`/api/members/${member.id}`, { method: "PATCH", body: { status: "ACTIVE" } }),
        { params: Promise.resolve({ id: member.id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ACTIVE");
    });
  });

  describe("Cascade Delete Tests", () => {
    it("Delete a Task directly via Prisma", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const task = await prisma.task.create({ data: { title: `Task${uniqueSuffix()}`, departmentId: dept.id } });
      await prisma.task.delete({ where: { id: task.id } });
      const found = await prisma.task.findUnique({ where: { id: task.id } });
      expect(found).toBeNull();
    });

    it("Delete a Department with tasks cascades task deletion", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      await prisma.task.create({ data: { title: `Task${uniqueSuffix()}`, departmentId: dept.id } });
      await prisma.task.create({ data: { title: `Task${uniqueSuffix()}`, departmentId: dept.id } });
      await prisma.department.delete({ where: { id: dept.id } });
      const tasks = await prisma.task.findMany({ where: { departmentId: dept.id } });
      expect(tasks).toHaveLength(0);
    });

    it("Delete a GalleryAlbum with items cascades item deletion", async () => {
      const { user, committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const album = await prisma.galleryAlbum.create({ data: { name: `Album${uniqueSuffix()}`, category: "PRODUCTIONS", departmentId: dept.id } });
      await prisma.galleryItem.create({ data: { albumId: album.id, r2Key: `key-${uniqueSuffix()}`, fileName: "file.jpg", type: "IMAGE", uploadedById: user.user.id } });
      await prisma.galleryItem.create({ data: { albumId: album.id, r2Key: `key-${uniqueSuffix()}`, fileName: "file2.jpg", type: "IMAGE", uploadedById: user.user.id } });
      await prisma.galleryAlbum.delete({ where: { id: album.id } });
      const items = await prisma.galleryItem.findMany({ where: { albumId: album.id } });
      expect(items).toHaveLength(0);
    });

    it("Delete a RegistrationWindow with applicants cascades applicant deletion", async () => {
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id } });
      await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id } });
      await prisma.registrationWindow.delete({ where: { id: rw.id } });
      const applicants = await prisma.applicant.findMany({ where: { registrationWindowId: rw.id } });
      expect(applicants).toHaveLength(0);
    });

    it("Delete a Committee with memberRoles cascades memberRole deletion", async () => {
      const committee = await createTestCommittee();
      const { member } = await setupAdmin();
      const role = await createTestRole();
      await assignCommitteeRole(member.id, role.id, committee.id);
      await prisma.committee.delete({ where: { id: committee.id } });
      const memberRoles = await prisma.committeeMemberRole.findMany({ where: { committeeId: committee.id } });
      expect(memberRoles).toHaveLength(0);
    });

    it("Delete a Member with department assignments cascades assignment deletion", async () => {
      const { member, committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      await assignDepartment(member.id, dept.id);
      await prisma.member.delete({ where: { id: member.id } });
      const assignments = await prisma.memberDepartment.findMany({ where: { memberId: member.id } });
      expect(assignments).toHaveLength(0);
    });

    it("Delete a User with notifications cascades notification deletion", async () => {
      const { user } = await setupAdmin();
      await prisma.notification.create({ data: { userId: user.user.id, type: "GENERAL", title: "Notif", message: "Test" } });
      await prisma.notification.create({ data: { userId: user.user.id, type: "EVENT", title: "Notif2", message: "Test2" } });
      await prisma.user.delete({ where: { id: user.user.id } });
      const notifs = await prisma.notification.findMany({ where: { userId: user.user.id } });
      expect(notifs).toHaveLength(0);
    });
  });

  describe("Composite Unique Constraints", () => {
    it("RolePermission: same roleId + permissionId is a duplicate", async () => {
      const role = await createTestRole();
      const perm = await prisma.permission.findFirst({ where: { key: "member.view" } });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm!.id } });
      await expect(prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm!.id } })).rejects.toThrow();
    });

    it("CommitteeMemberRole: same committeeId + memberId + roleId is a duplicate", async () => {
      const { member } = await setupAdmin();
      const committee = await createTestCommittee();
      const role = await createTestRole();
      await assignCommitteeRole(member.id, role.id, committee.id);
      await expect(assignCommitteeRole(member.id, role.id, committee.id)).rejects.toThrow();
    });

    it("Applicant: same registrationWindowId + email is a duplicate", async () => {
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      const email = `dup-${uniqueSuffix()}@test.com`;
      await prisma.applicant.create({ data: { name: "A", email, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id } });
      await expect(prisma.applicant.create({ data: { name: "B", email, phone: "0987654321", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id } })).rejects.toThrow();
    });
  });

  describe("Rate Limiting", () => {
    it("POST /api/registration-windows/:id/apply rate limits after 3 applications from same IP", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const uniqueIP = `192.168.1.${Math.floor(Math.random() * 200) + 50}`;
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      clearAuth();

      for (let i = 0; i < 3; i++) {
        const req = mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [dept.id] },
          headers: { "x-forwarded-for": uniqueIP },
        });
        const res = await APPLY_POST(req, { params: Promise.resolve({ id: rw.id }) });
        expect(res.status).toBe(201);
      }

      const rateLimitedReq = mockRequest(`/api/registration-windows/${rw.id}/apply`, {
        method: "POST",
        body: { name: `App${uniqueSuffix()}`, email: `app-overflow-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [dept.id] },
        headers: { "x-forwarded-for": uniqueIP },
      });
      const rateLimitedRes = await APPLY_POST(rateLimitedReq, { params: Promise.resolve({ id: rw.id }) });
      expect(rateLimitedRes.status).toBe(429);
    });
  });

  describe("Additional Edge Cases", () => {
    it("GET /api/members with invalid page/limit params (non-numeric)", async () => {
      await setupAdmin();
      const { GET: MEMBERS_GET } = await import("@/app/api/members/route");
      const res = await MEMBERS_GET(mockRequest("/api/members", { searchParams: { page: "abc", limit: "xyz" } }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.pagination).toBeDefined();
    });

    it("GET /api/events with invalid type filter returns 400", async () => {
      await setupAdmin();
      const { GET: EVENTS_GET } = await import("@/app/api/events/route");
      const res = await EVENTS_GET(mockRequest("/api/events", { searchParams: { type: "INVALID_TYPE" } }));
      expect(res.status).toBe(400);
    });

    it("GET /api/updates with invalid category filter returns 400", async () => {
      const { GET: UPDATES_GET } = await import("@/app/api/updates/route");
      const res = await UPDATES_GET(mockRequest("/api/updates", { searchParams: { category: "INVALID_CAT" } }));
      expect(res.status).toBe(400);
    });

    it("POST /api/departments with empty name (400)", async () => {
      const { committee } = await setupAdmin();
      const { POST: DEPTS_POST } = await import("@/app/api/departments/route");
      const res = await DEPTS_POST(
        mockRequest("/api/departments", { method: "POST", body: { name: "", committeeId: committee.id } })
      );
      expect(res.status).toBe(400);
    });

    it("POST /api/events with past startAt still works", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const { POST: EVENTS_POST } = await import("@/app/api/events/route");
      const res = await EVENTS_POST(
        mockRequest("/api/events", { method: "POST", body: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: "2020-01-01T10:00:00.000Z", departmentId: dept.id } })
      );
      expect(res.status).toBe(201);
    });

    it("GET /api/notifications returns only user's own notifications", async () => {
      const { user } = await setupAdmin();
      const otherUser = await createTestUser({ email: `other-${uniqueSuffix()}@test.com` });
      await prisma.notification.create({ data: { userId: user.user.id, type: "GENERAL", title: "Mine", message: "My notif" } });
      await prisma.notification.create({ data: { userId: otherUser.user.id, type: "GENERAL", title: "Theirs", message: "Their notif" } });
      mockAuth(user.user.id, []);
      const res = await NOTIFS_GET(mockRequest("/api/notifications"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.notifications.every((n: { userId: string }) => n.userId === user.user.id)).toBe(true);
    });

    it("PATCH /api/settings with empty object succeeds", async () => {
      await setupAdmin();
      const { PATCH: SETTINGS_PATCH } = await import("@/app/api/settings/route");
      const res = await SETTINGS_PATCH(
        mockRequest("/api/settings", { method: "PATCH", body: {} })
      );
      expect(res.status).toBe(200);
    });

    it("GET /api/roles/:id includes permissions in response", async () => {
      await setupAdmin();
      const perm = await prisma.permission.findFirst({ where: { key: "member.view" } });
      const role = await createTestRole({ name: `WithPerm${uniqueSuffix()}`, permissionIds: [perm!.id] });
      const { GET: ROLE_GET } = await import("@/app/api/roles/[id]/route");
      const res = await ROLE_GET(mockRequest(`/api/roles/${role.id}`), { params: Promise.resolve({ id: role.id }) });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.permissions).toBeDefined();
      expect(data.permissions.length).toBeGreaterThan(0);
    });

    it("POST /api/committees with isCurrent=true archives old current", async () => {
      const old = await createTestCommittee({ isCurrent: true });
      await setupAdmin();
      const { POST: COMMITTEES_POST } = await import("@/app/api/committees/route");
      await COMMITTEES_POST(
        mockRequest("/api/committees", { method: "POST", body: { year: `20${uniqueSuffix().slice(-2)}`, startDate: "2030-01-01T00:00:00.000Z" } })
      );
      const updatedOld = await prisma.committee.findUnique({ where: { id: old.id } });
      expect(updatedOld!.isCurrent).toBe(false);
    });

    it("Multiple departments in same committee", async () => {
      const { committee } = await setupAdmin();
      await createTestDepartment({ committeeId: committee.id, name: `Dept1-${uniqueSuffix()}` });
      await createTestDepartment({ committeeId: committee.id, name: `Dept2-${uniqueSuffix()}` });
      const depts = await prisma.department.findMany({ where: { committeeId: committee.id } });
      expect(depts.length).toBeGreaterThanOrEqual(2);
    });

    it("Member in multiple departments", async () => {
      const { member, committee } = await setupAdmin();
      const dept1 = await createTestDepartment({ committeeId: committee.id, name: `Dept1-${uniqueSuffix()}` });
      const dept2 = await createTestDepartment({ committeeId: committee.id, name: `Dept2-${uniqueSuffix()}` });
      await assignDepartment(member.id, dept1.id);
      await assignDepartment(member.id, dept2.id);
      const assignments = await prisma.memberDepartment.findMany({ where: { memberId: member.id } });
      expect(assignments).toHaveLength(2);
    });

    it("Task with description field", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const task = await prisma.task.create({ data: { title: `Task${uniqueSuffix()}`, description: "This is a detailed description", departmentId: dept.id } });
      expect(task.description).toBe("This is a detailed description");
    });

    it("Event with all fields populated", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "PERFORMANCE", startAt: new Date("2030-06-01T10:00:00.000Z"), endAt: new Date("2030-06-01T12:00:00.000Z"), location: "Main Hall", description: "Annual performance", departmentId: dept.id, status: "UPCOMING" } });
      expect(ev.endAt).not.toBeNull();
      expect(ev.location).toBe("Main Hall");
      expect(ev.description).toBe("Annual performance");
    });

    it("Gallery album with department", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const album = await prisma.galleryAlbum.create({ data: { name: `Album${uniqueSuffix()}`, category: "PRODUCTIONS", departmentId: dept.id } });
      expect(album.departmentId).toBe(dept.id);
    });

    it("Registration window with formSchema", async () => {
      const formSchema = { fields: [{ name: "experience", type: "text", label: "Experience", required: true }] };
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "DRAFT", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31"), formSchema } });
      const fetched = await prisma.registrationWindow.findUnique({ where: { id: rw.id } });
      expect(fetched!.formSchema).toEqual(formSchema);
    });

    it("GET /api/registration-windows/:id/applicants returns applicants list", async () => {
      const { user } = await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "SUBMITTED" } });
      mockAuth(user.user.id, ["registration.review"]);
      const res = await RW_APPLICANTS_GET(
        mockRequest(`/api/registration-windows/${rw.id}/applicants`),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.applicants).toBeDefined();
      expect(data.applicants.length).toBeGreaterThanOrEqual(1);
    });

    it("GET /api/registration-windows/:id/applicants with status filter", async () => {
      const { user } = await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "SUBMITTED" } });
      await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "ACCEPTED" } });
      mockAuth(user.user.id, ["registration.review"]);
      const res = await RW_APPLICANTS_GET(
        mockRequest(`/api/registration-windows/${rw.id}/applicants`, { searchParams: { status: "SUBMITTED" } }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.applicants.every((a: { status: string }) => a.status === "SUBMITTED")).toBe(true);
    });

    it("GET /api/registration-windows/:id/applicants with search filter", async () => {
      const { user } = await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      const searchEmail = `searchme-${uniqueSuffix()}@test.com`;
      await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: searchEmail, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "SUBMITTED" } });
      await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `other-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "SUBMITTED" } });
      mockAuth(user.user.id, ["registration.review"]);
      const res = await RW_APPLICANTS_GET(
        mockRequest(`/api/registration-windows/${rw.id}/applicants`, { searchParams: { search: searchEmail.split("@")[0] } }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.applicants.some((a: { email: string }) => a.email === searchEmail)).toBe(true);
    });

    it("PATCH /api/registration-windows/:id/applicants/:applicantId rejects UNDER_REVIEW status (not in schema)", async () => {
      const { user } = await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "SUBMITTED" } });
      mockAuth(user.user.id, ["registration.review"]);
      const res = await RW_APPLICANT_PATCH(
        mockRequest(`/api/registration-windows/${rw.id}/applicants/${applicant.id}`, { method: "PATCH", body: { status: "UNDER_REVIEW" } }),
        { params: Promise.resolve({ id: rw.id, applicantId: applicant.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("PATCH /api/applicants/:id rejects UNDER_REVIEW status (not in schema)", async () => {
      const { user } = await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "SUBMITTED" } });
      mockAuth(user.user.id, ["registration.review"]);
      const res = await APPLICANT_PATCH(
        mockRequest(`/api/applicants/${applicant.id}`, { method: "PATCH", body: { status: "UNDER_REVIEW" } }),
        { params: Promise.resolve({ id: applicant.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("POST /api/applicants/:id/convert with ACCEPTED applicant", async () => {
      const { user } = await setupAdmin();
      const committee = await createTestCommittee();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [dept.id], registrationWindowId: rw.id, status: "ACCEPTED" } });
      mockAuth(user.user.id, ["member.create", "registration.review"]);
      const res = await CONVERT_POST(
        mockRequest(`/api/applicants/${applicant.id}/convert`, { method: "POST", body: {} }),
        { params: Promise.resolve({ id: applicant.id }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.member).toBeDefined();
      expect(data.member.memberCode).toBeDefined();
    });

    it("POST /api/applicants/:id/convert with already converted applicant returns 409", async () => {
      const { user } = await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      const convertedMember = await createTestMember({ status: "ACTIVE" });
      const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "ACCEPTED", convertedMemberId: convertedMember.id } });
      mockAuth(user.user.id, ["member.create"]);
      const res = await CONVERT_POST(
        mockRequest(`/api/applicants/${applicant.id}/convert`, { method: "POST", body: {} }),
        { params: Promise.resolve({ id: applicant.id }) }
      );
      expect(res.status).toBe(409);
    });

    it("POST /api/applicants/:id/convert with non-ACCEPTED applicant returns 400", async () => {
      const { user } = await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      const applicant = await prisma.applicant.create({ data: { name: `App${uniqueSuffix()}`, email: `app-${uniqueSuffix()}@test.com`, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [], registrationWindowId: rw.id, status: "SUBMITTED" } });
      mockAuth(user.user.id, ["member.create"]);
      const res = await CONVERT_POST(
        mockRequest(`/api/applicants/${applicant.id}/convert`, { method: "POST", body: {} }),
        { params: Promise.resolve({ id: applicant.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("GET /api/events/:id returns 404 for DRAFT event", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "DRAFT" } });
      clearAuth();
      const res = await EVENT_GET(mockRequest(`/api/events/${ev.id}`), { params: Promise.resolve({ id: ev.id }) });
      expect(res.status).toBe(404);
    });

    it("PATCH /api/events/:id with endAt before startAt returns 400", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "DRAFT" } });
      const res = await EVENT_PATCH(
        mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { endAt: "2030-06-01T08:00:00.000Z" } }),
        { params: Promise.resolve({ id: ev.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("PATCH /api/events/:id with non-existent departmentId returns 404", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const ev = await prisma.event.create({ data: { title: `Ev${uniqueSuffix()}`, type: "WORKSHOP", startAt: new Date("2030-06-01T10:00:00.000Z"), departmentId: dept.id, status: "DRAFT" } });
      const res = await EVENT_PATCH(
        mockRequest(`/api/events/${ev.id}`, { method: "PATCH", body: { departmentId: NON_EXISTENT_CUID } }),
        { params: Promise.resolve({ id: ev.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("GET /api/events/:id returns 404 for non-existent event", async () => {
      clearAuth();
      const res = await EVENT_GET(mockRequest(`/api/events/${NON_EXISTENT_CUID}`), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(404);
    });

    it("GET /api/applicants/:id returns 404 for non-existent applicant", async () => {
      const { user } = await setupAdmin();
      mockAuth(user.user.id, ["registration.review"]);
      const res = await APPLICANT_GET(mockRequest(`/api/applicants/${NON_EXISTENT_CUID}`), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(404);
    });

    it("POST /api/promotions/:id/submit returns 404 for non-existent promotion", async () => {
      const { user } = await setupUserWithPerms(["promotion.submit"]);
      mockAuth(user.user.id, ["promotion.submit"]);
      const res = await PROMO_SUBMIT(
        mockRequest(`/api/promotions/${NON_EXISTENT_CUID}/submit`, { method: "POST" }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(404);
    });

    it("POST /api/promotions/:id/decision returns 404 for non-existent promotion", async () => {
      const { user } = await setupUserWithPerms(["promotion.approve"]);
      mockAuth(user.user.id, ["promotion.approve"]);
      const res = await PROMO_DECISION(
        mockRequest(`/api/promotions/${NON_EXISTENT_CUID}/decision`, { method: "POST", body: { status: "APPROVED" } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(404);
    });

    it("GET /api/committees/:id returns 404 for non-existent committee", async () => {
      clearAuth();
      const res = await COMMITTEE_GET(mockRequest(`/api/committees/${NON_EXISTENT_CUID}`), { params: Promise.resolve({ id: NON_EXISTENT_CUID }) });
      expect(res.status).toBe(404);
    });

    it("POST /api/applicants/:id/convert with non-existent applicant returns 404", async () => {
      const { user } = await setupAdmin();
      mockAuth(user.user.id, ["member.create"]);
      const res = await CONVERT_POST(
        mockRequest(`/api/applicants/${NON_EXISTENT_CUID}/convert`, { method: "POST", body: {} }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(404);
    });

    it("Registration window apply returns 404 for non-existent window", async () => {
      clearAuth();
      const uniqueIP = `192.168.4.${Math.floor(Math.random() * 200) + 50}`;
      const res = await APPLY_POST(
        mockRequest(`/api/registration-windows/${NON_EXISTENT_CUID}/apply`, { method: "POST", body: { name: "Test", email: "t@test.com", phone: "1234567890", studentId: "SID-1", departmentPrefs: [NON_EXISTENT_CUID] }, headers: { "x-forwarded-for": uniqueIP } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(404);
    });

    it("Registration window apply returns 400 for non-LIVE window", async () => {
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "DRAFT", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      clearAuth();
      const uniqueIP = `192.168.5.${Math.floor(Math.random() * 200) + 50}`;
      const res = await APPLY_POST(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, { method: "POST", body: { name: "Test", email: "t@test.com", phone: "1234567890", studentId: "SID-1", departmentPrefs: [NON_EXISTENT_CUID] }, headers: { "x-forwarded-for": uniqueIP } }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("Registration window apply returns 409 for duplicate email", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const uniqueIP = `192.168.2.${Math.floor(Math.random() * 200) + 50}`;
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      clearAuth();
      const email = `dup-${uniqueSuffix()}@test.com`;
      await APPLY_POST(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, { method: "POST", body: { name: "App1", email, phone: "1234567890", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [dept.id] }, headers: { "x-forwarded-for": uniqueIP } }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      const res = await APPLY_POST(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, { method: "POST", body: { name: "App2", email, phone: "0987654321", studentId: `SID-${uniqueSuffix()}`, departmentPrefs: [dept.id] }, headers: { "x-forwarded-for": uniqueIP } }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(409);
    });

    it("Registration window apply returns 400 for invalid departmentPrefs", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({ data: { title: `RW${uniqueSuffix()}`, description: "Test description", status: "LIVE", startDate: new Date("2020-01-01"), endDate: new Date("2030-12-31") } });
      clearAuth();
      const uniqueIP = `192.168.3.${Math.floor(Math.random() * 200) + 50}`;
      const res = await APPLY_POST(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, { method: "POST", body: { name: "Test", email: "t@test.com", phone: "1234567890", studentId: "SID-1", departmentPrefs: [NON_EXISTENT_CUID] }, headers: { "x-forwarded-for": uniqueIP } }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
    });
  });
});
