/**
 * IDOR / BOLA suite — object-level authorization on every parameterised route.
 *
 * The question each test asks is the attacker's question: "I am authenticated,
 * but this object is not mine and I hold no permission over it. If I swap the
 * id in the URL, do I get the data?"
 *
 * Two actors are used throughout:
 *   - `outsider`  — a real, logged-in member holding NO permissions at all.
 *                   This is the realistic attacker: a legitimate account.
 *   - `owner`     — the member the target resources actually belong to.
 *
 * Anything other than 401/403/404 for the outsider is a finding. 404 is
 * acceptable (and preferable) where confirming existence would itself leak
 * information.
 *
 * Note on permission checks: `can()` reads roles from the database, so the
 * permissions array passed to `mockAuth` does not grant anything on its own —
 * an actor is only privileged if a committee role was created for them here.
 */
import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/lib/prisma";

import { GET as MEMBER_GET, PATCH as MEMBER_PATCH } from "@/app/api/members/[id]/route";
import { GET as MEMBERS_LIST } from "@/app/api/members/route";
import { POST as MEMBER_DEPT_POST, DELETE as MEMBER_DEPT_DELETE } from "@/app/api/members/[id]/departments/route";
import { POST as NOTIF_READ } from "@/app/api/notifications/[id]/read/route";
import { GET as PROMO_GET } from "@/app/api/promotions/[id]/route";
import { POST as PROMO_SUBMIT } from "@/app/api/promotions/[id]/submit/route";
import { POST as PROMO_DECISION } from "@/app/api/promotions/[id]/decision/route";
import { GET as TASKS_GET, POST as TASKS_POST } from "@/app/api/departments/[id]/tasks/route";
import { PATCH as TASK_PATCH, DELETE as TASK_DELETE } from "@/app/api/departments/[id]/tasks/[taskId]/route";
import { GET as DEPT_GET, PATCH as DEPT_PATCH, DELETE as DEPT_DELETE } from "@/app/api/departments/[id]/route";
import { PATCH as COMMITTEE_PATCH } from "@/app/api/committees/[id]/route";
import { POST as COMMITTEE_ROLE_POST, DELETE as COMMITTEE_ROLE_DELETE } from "@/app/api/committees/[id]/roles/route";
import { GET as APPLICANT_GET, PATCH as APPLICANT_PATCH } from "@/app/api/applicants/[id]/route";
import { POST as APPLICANT_CONVERT } from "@/app/api/applicants/[id]/convert/route";
import { GET as WINDOW_APPLICANTS } from "@/app/api/registration-windows/[id]/applicants/route";
import { PATCH as WINDOW_APPLICANT_PATCH } from "@/app/api/registration-windows/[id]/applicants/[applicantId]/route";
import { PATCH as WINDOW_PATCH } from "@/app/api/registration-windows/[id]/route";
import { PATCH as UPDATE_PATCH, DELETE as UPDATE_DELETE } from "@/app/api/updates/[id]/route";
import { PATCH as EVENT_PATCH, DELETE as EVENT_DELETE } from "@/app/api/events/[id]/route";
import { PATCH as ALBUM_PATCH, DELETE as ALBUM_DELETE } from "@/app/api/gallery/[id]/route";
import { DELETE as GALLERY_ITEM_DELETE } from "@/app/api/gallery/items/[id]/route";
import { PATCH as ROLE_PATCH, DELETE as ROLE_DELETE } from "@/app/api/roles/[id]/route";
import { PATCH as CONTACT_PATCH, DELETE as CONTACT_DELETE } from "@/app/api/contacts/[id]/route";

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
  assignDepartment,
  uniqueSuffix,
} from "./helpers";

/** Statuses that represent a correctly refused request. */
const DENIED = [401, 403, 404];

function expectDenied(status: number, label: string) {
  expect(
    DENIED.includes(status),
    `${label} returned ${status}; expected one of ${DENIED.join("/")} — a non-owner reached this object`
  ).toBe(true);
}

describe("IDOR / object-level authorization", () => {
  // Actors
  let outsiderUserId: string;
  let outsiderMemberId: string;
  let ownerUserId: string;
  let ownerMemberId: string;

  // Resources owned by someone else
  let committeeId: string;
  let departmentId: string;
  let taskId: string;
  let promotionId: string;
  let notificationId: string;
  let applicantId: string;
  let windowId: string;
  let updateId: string;
  let eventId: string;
  let albumId: string;
  let galleryItemId: string;
  let roleId: string;
  let contactId: string;

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const committee = await createTestCommittee({ isCurrent: true });
    committeeId = committee.id;

    // --- The attacker: a genuine account with zero permissions -------------
    const outsider = await createTestUser({ email: `outsider-${uniqueSuffix()}@test.com` });
    outsiderUserId = outsider.user.id;
    outsiderMemberId = (await createTestMember({ userId: outsiderUserId, status: "ACTIVE" })).id;

    // --- The victim --------------------------------------------------------
    const owner = await createTestUser({ email: `owner-${uniqueSuffix()}@test.com` });
    ownerUserId = owner.user.id;
    const ownerMember = await createTestMember({ userId: ownerUserId, status: "ACTIVE" });
    ownerMemberId = ownerMember.id;

    // --- Resources the outsider has no claim to ---------------------------
    const dept = await createTestDepartment({ committeeId });
    departmentId = dept.id;
    await assignDepartment(ownerMemberId, departmentId);

    taskId = (
      await prisma.task.create({ data: { departmentId, title: "Private task" } })
    ).id;

    const roleA = await createTestRole({ name: `Cur-${uniqueSuffix()}` });
    const roleB = await createTestRole({ name: `Prop-${uniqueSuffix()}` });
    roleId = roleA.id;
    await assignCommitteeRole(ownerMemberId, roleA.id, committeeId);

    promotionId = (
      await prisma.promotionRequest.create({
        data: {
          memberId: ownerMemberId,
          currentRoleId: roleA.id,
          proposedRoleId: roleB.id,
          reason: "Confidential justification",
          submittedById: ownerUserId,
          status: "SUBMITTED",
        },
      })
    ).id;

    notificationId = (
      await prisma.notification.create({
        data: {
          userId: ownerUserId,
          type: "GENERAL",
          title: "Private notification",
          message: "Not for the outsider",
        },
      })
    ).id;

    const window = await prisma.registrationWindow.create({
      data: {
        title: `W-${uniqueSuffix()}`,
        description: "d",
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
        status: "LIVE",
      },
    });
    windowId = window.id;

    applicantId = (
      await prisma.applicant.create({
        data: {
          registrationWindowId: windowId,
          name: "Applicant Person",
          email: `applicant-${uniqueSuffix()}@test.com`,
          phone: "+8801700000000",
          studentId: "S-1",
          departmentPrefs: [],
          skills: [],
        },
      })
    ).id;

    updateId = (
      await prisma.clubUpdate.create({
        data: {
          title: "Draft update",
          bodyRichText: "<p>secret</p>",
          category: "ANNOUNCEMENT",
          authorId: ownerUserId,
        },
      })
    ).id;

    eventId = (
      await prisma.event.create({
        data: { title: "Private event", type: "REHEARSAL", startAt: new Date(Date.now() + 86400000) },
      })
    ).id;

    const album = await prisma.galleryAlbum.create({
      data: { name: `A-${uniqueSuffix()}`, category: "PRODUCTIONS" },
    });
    albumId = album.id;

    galleryItemId = (
      await prisma.galleryItem.create({
        data: {
          albumId,
          r2Key: "gallery/x.jpg",
          fileName: "x.jpg",
          type: "IMAGE",
          uploadedById: ownerUserId,
        },
      })
    ).id;

    contactId = (
      await prisma.contactSubmission.create({
        data: { name: "Someone", email: "s@example.com", message: "Private message body" },
      })
    ).id;

    // Every test below runs as the permission-less outsider unless it says
    // otherwise.
    mockAuth(outsiderUserId, []);
  });

  // -------------------------------------------------------------------------
  describe("another member's personal data", () => {
    it("cannot edit another member's profile", async () => {
      const res = await MEMBER_PATCH(
        mockRequest(`/api/members/${ownerMemberId}`, {
          method: "PATCH",
          body: { phone: "+8800000000000", address: "attacker controlled" },
        }),
        { params: Promise.resolve({ id: ownerMemberId }) }
      );
      expectDenied(res.status, "PATCH /api/members/:id");

      const after = await prisma.member.findUnique({ where: { id: ownerMemberId } });
      expect(after?.address).not.toBe("attacker controlled");
    });

    it("cannot read another member's profile without member.view", async () => {
      const res = await MEMBER_GET(mockRequest(`/api/members/${ownerMemberId}`), {
        params: Promise.resolve({ id: ownerMemberId }),
      });
      expectDenied(res.status, "GET /api/members/:id");
    });

    it("cannot add or remove another member's department assignments", async () => {
      const add = await MEMBER_DEPT_POST(
        mockRequest(`/api/members/${ownerMemberId}/departments`, {
          method: "POST",
          body: { departmentId },
        }),
        { params: Promise.resolve({ id: ownerMemberId }) }
      );
      expectDenied(add.status, "POST /api/members/:id/departments");

      const del = await MEMBER_DEPT_DELETE(
        mockRequest(`/api/members/${ownerMemberId}/departments?departmentId=${departmentId}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: ownerMemberId }) }
      );
      expectDenied(del.status, "DELETE /api/members/:id/departments");
    });
  });

  // -------------------------------------------------------------------------
  describe("another user's notifications", () => {
    it("cannot mark another user's notification as read", async () => {
      const res = await NOTIF_READ(
        mockRequest(`/api/notifications/${notificationId}/read`, { method: "POST" }),
        { params: Promise.resolve({ id: notificationId }) }
      );
      expectDenied(res.status, "POST /api/notifications/:id/read");

      const after = await prisma.notification.findUnique({ where: { id: notificationId } });
      expect(after?.readAt).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("another member's promotion case file", () => {
    it("cannot read it by id", async () => {
      const res = await PROMO_GET(mockRequest(`/api/promotions/${promotionId}`), {
        params: Promise.resolve({ id: promotionId }),
      });
      expectDenied(res.status, "GET /api/promotions/:id");
    });

    it("cannot submit it", async () => {
      const res = await PROMO_SUBMIT(
        mockRequest(`/api/promotions/${promotionId}/submit`, { method: "POST" }),
        { params: Promise.resolve({ id: promotionId }) }
      );
      expectDenied(res.status, "POST /api/promotions/:id/submit");
    });

    it("cannot decide it", async () => {
      const res = await PROMO_DECISION(
        mockRequest(`/api/promotions/${promotionId}/decision`, {
          method: "POST",
          body: { status: "APPROVED" },
        }),
        { params: Promise.resolve({ id: promotionId }) }
      );
      expectDenied(res.status, "POST /api/promotions/:id/decision");

      const after = await prisma.promotionRequest.findUnique({ where: { id: promotionId } });
      expect(after?.status).toBe("SUBMITTED");
    });
  });

  // -------------------------------------------------------------------------
  describe("a department the outsider does not belong to", () => {
    it("cannot list its tasks", async () => {
      const res = await TASKS_GET(mockRequest(`/api/departments/${departmentId}/tasks`), {
        params: Promise.resolve({ id: departmentId }),
      });
      expectDenied(res.status, "GET /api/departments/:id/tasks");
    });

    it("cannot create a task in it", async () => {
      const res = await TASKS_POST(
        mockRequest(`/api/departments/${departmentId}/tasks`, {
          method: "POST",
          body: { title: "injected" },
        }),
        { params: Promise.resolve({ id: departmentId }) }
      );
      expectDenied(res.status, "POST /api/departments/:id/tasks");
    });

    it("cannot edit or delete its tasks", async () => {
      const patch = await TASK_PATCH(
        mockRequest(`/api/departments/${departmentId}/tasks/${taskId}`, {
          method: "PATCH",
          body: { title: "hijacked" },
        }),
        { params: Promise.resolve({ id: departmentId, taskId }) }
      );
      expectDenied(patch.status, "PATCH task");

      const del = await TASK_DELETE(
        mockRequest(`/api/departments/${departmentId}/tasks/${taskId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: departmentId, taskId }) }
      );
      expectDenied(del.status, "DELETE task");

      const after = await prisma.task.findUnique({ where: { id: taskId } });
      expect(after).not.toBeNull();
      expect(after?.title).toBe("Private task");
    });

    it("cannot read, edit or delete the department itself", async () => {
      const get = await DEPT_GET(mockRequest(`/api/departments/${departmentId}`), {
        params: Promise.resolve({ id: departmentId }),
      });
      expectDenied(get.status, "GET /api/departments/:id");

      const patch = await DEPT_PATCH(
        mockRequest(`/api/departments/${departmentId}`, { method: "PATCH", body: { name: "pwned" } }),
        { params: Promise.resolve({ id: departmentId }) }
      );
      expectDenied(patch.status, "PATCH /api/departments/:id");

      const del = await DEPT_DELETE(
        mockRequest(`/api/departments/${departmentId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: departmentId }) }
      );
      expectDenied(del.status, "DELETE /api/departments/:id");

      expect(await prisma.department.findUnique({ where: { id: departmentId } })).not.toBeNull();
    });

    it("a member of ONE department cannot read another department's tasks", async () => {
      // Sharper than the permission-less case: this actor legitimately belongs
      // to a department, just not this one.
      const otherDept = await createTestDepartment({ committeeId });
      await assignDepartment(outsiderMemberId, otherDept.id);
      mockAuth(outsiderUserId, []);

      const res = await TASKS_GET(mockRequest(`/api/departments/${departmentId}/tasks`), {
        params: Promise.resolve({ id: departmentId }),
      });
      expectDenied(res.status, "GET tasks of a foreign department");
    });
  });

  // -------------------------------------------------------------------------
  describe("recruitment data", () => {
    it("cannot read an applicant record", async () => {
      const res = await APPLICANT_GET(mockRequest(`/api/applicants/${applicantId}`), {
        params: Promise.resolve({ id: applicantId }),
      });
      expectDenied(res.status, "GET /api/applicants/:id");
    });

    it("cannot accept or reject an applicant", async () => {
      const res = await APPLICANT_PATCH(
        mockRequest(`/api/applicants/${applicantId}`, {
          method: "PATCH",
          body: { status: "ACCEPTED" },
        }),
        { params: Promise.resolve({ id: applicantId }) }
      );
      expectDenied(res.status, "PATCH /api/applicants/:id");

      const after = await prisma.applicant.findUnique({ where: { id: applicantId } });
      expect(after?.status).toBe("SUBMITTED");
    });

    it("cannot convert an applicant into a member account", async () => {
      const res = await APPLICANT_CONVERT(
        mockRequest(`/api/applicants/${applicantId}/convert`, { method: "POST", body: {} }),
        { params: Promise.resolve({ id: applicantId }) }
      );
      expectDenied(res.status, "POST /api/applicants/:id/convert");
    });

    it("cannot list a registration window's applicants", async () => {
      const res = await WINDOW_APPLICANTS(
        mockRequest(`/api/registration-windows/${windowId}/applicants`),
        { params: Promise.resolve({ id: windowId }) }
      );
      expectDenied(res.status, "GET window applicants");
    });

    it("cannot patch an applicant through the window-scoped route", async () => {
      const res = await WINDOW_APPLICANT_PATCH(
        mockRequest(`/api/registration-windows/${windowId}/applicants/${applicantId}`, {
          method: "PATCH",
          body: { status: "ACCEPTED" },
        }),
        { params: Promise.resolve({ id: windowId, applicantId }) }
      );
      expectDenied(res.status, "PATCH window applicant");
    });

    it("cannot modify the registration window", async () => {
      const res = await WINDOW_PATCH(
        mockRequest(`/api/registration-windows/${windowId}`, {
          method: "PATCH",
          body: { status: "CLOSED" },
        }),
        { params: Promise.resolve({ id: windowId }) }
      );
      expectDenied(res.status, "PATCH /api/registration-windows/:id");
    });
  });

  // -------------------------------------------------------------------------
  describe("content owned by others", () => {
    it("cannot edit or delete a club update", async () => {
      const patch = await UPDATE_PATCH(
        mockRequest(`/api/updates/${updateId}`, { method: "PATCH", body: { title: "defaced" } }),
        { params: Promise.resolve({ id: updateId }) }
      );
      expectDenied(patch.status, "PATCH /api/updates/:id");

      const del = await UPDATE_DELETE(
        mockRequest(`/api/updates/${updateId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: updateId }) }
      );
      expectDenied(del.status, "DELETE /api/updates/:id");

      const after = await prisma.clubUpdate.findUnique({ where: { id: updateId } });
      expect(after?.title).toBe("Draft update");
    });

    it("cannot edit or delete an event", async () => {
      const patch = await EVENT_PATCH(
        mockRequest(`/api/events/${eventId}`, { method: "PATCH", body: { title: "defaced" } }),
        { params: Promise.resolve({ id: eventId }) }
      );
      expectDenied(patch.status, "PATCH /api/events/:id");

      const del = await EVENT_DELETE(
        mockRequest(`/api/events/${eventId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: eventId }) }
      );
      expectDenied(del.status, "DELETE /api/events/:id");

      expect(await prisma.event.findUnique({ where: { id: eventId } })).not.toBeNull();
    });

    it("cannot edit or delete a gallery album", async () => {
      const patch = await ALBUM_PATCH(
        mockRequest(`/api/gallery/${albumId}`, { method: "PATCH", body: { name: "defaced" } }),
        { params: Promise.resolve({ id: albumId }) }
      );
      expectDenied(patch.status, "PATCH /api/gallery/:id");

      const del = await ALBUM_DELETE(
        mockRequest(`/api/gallery/${albumId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: albumId }) }
      );
      expectDenied(del.status, "DELETE /api/gallery/:id");

      expect(await prisma.galleryAlbum.findUnique({ where: { id: albumId } })).not.toBeNull();
    });

    it("cannot delete someone else's gallery item", async () => {
      const res = await GALLERY_ITEM_DELETE(
        mockRequest(`/api/gallery/items/${galleryItemId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: galleryItemId }) }
      );
      expectDenied(res.status, "DELETE /api/gallery/items/:id");

      expect(await prisma.galleryItem.findUnique({ where: { id: galleryItemId } })).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("privilege escalation surfaces", () => {
    it("cannot edit or delete a role", async () => {
      const patch = await ROLE_PATCH(
        mockRequest(`/api/roles/${roleId}`, { method: "PATCH", body: { name: "Superuser" } }),
        { params: Promise.resolve({ id: roleId }) }
      );
      expectDenied(patch.status, "PATCH /api/roles/:id");

      const del = await ROLE_DELETE(
        mockRequest(`/api/roles/${roleId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: roleId }) }
      );
      expectDenied(del.status, "DELETE /api/roles/:id");
    });

    it("cannot grant itself a committee role", async () => {
      const res = await COMMITTEE_ROLE_POST(
        mockRequest(`/api/committees/${committeeId}/roles`, {
          method: "POST",
          body: { memberId: outsiderMemberId, roleId },
        }),
        { params: Promise.resolve({ id: committeeId }) }
      );
      expectDenied(res.status, "POST /api/committees/:id/roles");

      const granted = await prisma.committeeMemberRole.findFirst({
        where: { memberId: outsiderMemberId },
      });
      expect(granted, "outsider granted themselves a committee role").toBeNull();
    });

    it("cannot strip another member's committee role", async () => {
      const victimRole = await prisma.committeeMemberRole.findFirst({
        where: { memberId: ownerMemberId },
      });
      const res = await COMMITTEE_ROLE_DELETE(
        mockRequest(`/api/committees/${committeeId}/roles?memberRoleId=${victimRole!.id}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: committeeId }) }
      );
      expectDenied(res.status, "DELETE /api/committees/:id/roles");

      const after = await prisma.committeeMemberRole.findUnique({ where: { id: victimRole!.id } });
      expect(after?.endedAt).toBeNull();
    });

    it("cannot modify a committee", async () => {
      const res = await COMMITTEE_PATCH(
        mockRequest(`/api/committees/${committeeId}`, {
          method: "PATCH",
          body: { year: "1999-2000" },
        }),
        { params: Promise.resolve({ id: committeeId }) }
      );
      expectDenied(res.status, "PATCH /api/committees/:id");
    });
  });

  // -------------------------------------------------------------------------
  describe("contact inbox", () => {
    it("cannot read-modify or delete contact submissions", async () => {
      const patch = await CONTACT_PATCH(
        mockRequest(`/api/contacts/${contactId}`, { method: "PATCH", body: { handled: true } }),
        { params: Promise.resolve({ id: contactId }) }
      );
      expectDenied(patch.status, "PATCH /api/contacts/:id");

      const del = await CONTACT_DELETE(
        mockRequest(`/api/contacts/${contactId}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: contactId }) }
      );
      expectDenied(del.status, "DELETE /api/contacts/:id");

      expect(await prisma.contactSubmission.findUnique({ where: { id: contactId } })).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("personal data is not exposed by the directory permission", () => {
    /**
     * `member.view` is held by every seeded role, down to the base "Member".
     * It powers the member directory, so it must not also hand out home
     * addresses, phone numbers, dates of birth or emergency contacts — those
     * belong to the member themselves and to `member.edit` administrators.
     */
    const PERSONAL = ["phone", "address", "dateOfBirth", "emergencyContact"] as const;

    async function makeViewer(perms: string[]) {
      const u = await createTestUser({ email: `viewer-${uniqueSuffix()}@test.com` });
      const m = await createTestMember({ userId: u.user.id, status: "ACTIVE" });
      const ids = await Promise.all(
        perms.map(async (k) => (await prisma.permission.findUnique({ where: { key: k } }))!.id)
      );
      const role = await createTestRole({ name: `V-${uniqueSuffix()}`, permissionIds: ids });
      await assignCommitteeRole(m.id, role.id, committeeId);
      mockAuth(u.user.id, perms);
      return { userId: u.user.id, memberId: m.id };
    }

    beforeEach(async () => {
      // Give the victim something worth stealing.
      await prisma.member.update({
        where: { id: ownerMemberId },
        data: {
          phone: "+8801711111111",
          address: "House 7, Road 12, Dhanmondi",
          dateOfBirth: new Date("2001-04-04"),
          emergencyContact: "+8801799999999",
        },
      });
    });

    it("member.view alone cannot read another member's contact details", async () => {
      await makeViewer(["member.view"]);

      const res = await MEMBER_GET(mockRequest(`/api/members/${ownerMemberId}`), {
        params: Promise.resolve({ id: ownerMemberId }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();

      // Identity is fine — that is what a directory is for.
      expect(body.user.name).toBeTruthy();
      expect(body.memberCode).toBeTruthy();
      // Personal data must be absent entirely, not merely null.
      for (const field of PERSONAL) {
        expect(body[field], `${field} leaked to a member.view-only viewer`).toBeUndefined();
      }
    });

    it("member.view alone cannot harvest contact details from the members list", async () => {
      await makeViewer(["member.view"]);

      const res = await MEMBERS_LIST(mockRequest("/api/members", { searchParams: { limit: "100" } }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.members.length).toBeGreaterThan(0);

      for (const m of body.members) {
        for (const field of PERSONAL) {
          expect(m[field], `${field} leaked in the members list`).toBeUndefined();
        }
      }
    });

    it("a member can still read their OWN contact details", async () => {
      mockAuth(ownerUserId, []);

      const res = await MEMBER_GET(mockRequest(`/api/members/${ownerMemberId}`), {
        params: Promise.resolve({ id: ownerMemberId }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.phone).toBe("+8801711111111");
      expect(body.address).toBe("House 7, Road 12, Dhanmondi");
    });

    it("member.edit administrators can still read contact details", async () => {
      await makeViewer(["member.view", "member.edit"]);

      const res = await MEMBER_GET(mockRequest(`/api/members/${ownerMemberId}`), {
        params: Promise.resolve({ id: ownerMemberId }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.phone).toBe("+8801711111111");
      expect(body.emergencyContact).toBe("+8801799999999");
    });
  });

  // -------------------------------------------------------------------------
  describe("identifiers are not enumerable", () => {
    it("primary keys are random cuids, not sequential integers", async () => {
      // Sequential ids would let an attacker walk the whole table even with
      // authorization in place, by revealing how many records exist.
      const ids = [ownerMemberId, promotionId, applicantId, eventId, updateId];
      for (const id of ids) {
        expect(id).toMatch(/^c[a-z0-9]{20,}$/);
        expect(Number.isNaN(Number(id))).toBe(true);
      }
    });
  });
});
