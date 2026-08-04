import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as EVENTS_GET } from "@/app/api/events/route";
import { GET as EVENT_GET, PATCH as EVENT_PATCH } from "@/app/api/events/[id]/route";
import { PATCH as RW_PATCH } from "@/app/api/registration-windows/[id]/route";
import { GET as EXPORT_GET } from "@/app/api/applicants/export/route";
import { POST as PROMO_DECISION } from "@/app/api/promotions/[id]/decision/route";
import { GET as MEMBER_DASH } from "@/app/api/dashboard/member/route";
import { POST as CONTACT_POST } from "@/app/api/contact/route";
import { GET as PUBLIC_EVENTS } from "@/app/api/public/events/route";
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
  NON_EXISTENT_CUID,
} from "./helpers";
import prisma from "@/lib/prisma";

describe("Edge Cases & Coverage Gaps", () => {
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


  // ===========================================================================
  // 1. CSV EXPORT — SPECIAL CHARACTERS
  // ===========================================================================
  describe("CSV Export — Special Characters", () => {
    it("escapes commas in applicant name", async () => {
      await setupAdmin();
      const window = await prisma.registrationWindow.create({
        data: {
          title: `Export Test ${uniqueSuffix()}`,
          description: "Test description for export",
          status: "LIVE",
          startDate: new Date("2020-01-01"),
          endDate: new Date("2030-12-31"),
        },
      });
      await prisma.applicant.create({
        data: {
          registrationWindowId: window.id,
          name: "Doe, John",
          email: "doe@test.com",
          phone: "1234567890",
          studentId: "STU001",
          departmentPrefs: ["Acting"],
          status: "SUBMITTED",
        },
      });

      const res = await EXPORT_GET(
        mockRequest(`/api/applicants/export`, { searchParams: { windowId: window.id } })
      );
      expect(res.status).toBe(200);
      const body = await res.text();
      // Commas in values must be quoted
      expect(body).toContain('"Doe, John"');
    });

    it("escapes double quotes in applicant email", async () => {
      await setupAdmin();
      const window = await prisma.registrationWindow.create({
        data: {
          title: `Export Quote ${uniqueSuffix()}`,
          description: "Test description for export",
          status: "LIVE",
          startDate: new Date("2020-01-01"),
          endDate: new Date("2030-12-31"),
        },
      });
      await prisma.applicant.create({
        data: {
          registrationWindowId: window.id,
          name: 'John "Johnny" Doe',
          email: "johnny@test.com",
          phone: "1234567890",
          studentId: "STU002",
          departmentPrefs: ["Directing"],
          status: "SUBMITTED",
        },
      });

      const res = await EXPORT_GET(
        mockRequest(`/api/applicants/export`, { searchParams: { windowId: window.id } })
      );
      expect(res.status).toBe(200);
      const body = await res.text();
      // Double quotes must be escaped as ""
      expect(body).toContain('John ""Johnny"" Doe');
    });

    it("escapes newlines in applicant data", async () => {
      await setupAdmin();
      const window = await prisma.registrationWindow.create({
        data: {
          title: `Export NL ${uniqueSuffix()}`,
          description: "Test description for export",
          status: "LIVE",
          startDate: new Date("2020-01-01"),
          endDate: new Date("2030-12-31"),
        },
      });
      await prisma.applicant.create({
        data: {
          registrationWindowId: window.id,
          name: "John\nDoe",
          email: "newline@test.com",
          phone: "1234567890",
          studentId: "STU003",
          departmentPrefs: ["Acting"],
          status: "SUBMITTED",
        },
      });

      const res = await EXPORT_GET(
        mockRequest(`/api/applicants/export`, { searchParams: { windowId: window.id } })
      );
      expect(res.status).toBe(200);
      const body = await res.text();
      // Newlines in values must be quoted
      expect(body).toContain('"John\nDoe"');
    });

    it("returns empty CSV with headers for window with no applicants", async () => {
      await setupAdmin();
      const window = await prisma.registrationWindow.create({
        data: {
          title: `Export Empty ${uniqueSuffix()}`,
          description: "Test description for export",
          status: "LIVE",
          startDate: new Date("2020-01-01"),
          endDate: new Date("2030-12-31"),
        },
      });

      const res = await EXPORT_GET(
        mockRequest(`/api/applicants/export`, { searchParams: { windowId: window.id } })
      );
      expect(res.status).toBe(200);
      const body = await res.text();
      const lines = body.split("\n");
      // First line is headers, no data rows
      expect(lines[0]).toContain("Name");
      expect(lines[0]).toContain("Email");
      expect(lines.length).toBe(1);
    });

    it("sanitizes CSV formula injection characters", async () => {
      await setupAdmin();
      const window = await prisma.registrationWindow.create({
        data: {
          title: `Export Formula ${uniqueSuffix()}`,
          description: "Test description for export",
          status: "LIVE",
          startDate: new Date("2020-01-01"),
          endDate: new Date("2030-12-31"),
        },
      });
      await prisma.applicant.create({
        data: {
          registrationWindowId: window.id,
          name: "=SUM(A1:A10)",
          email: "+attacker@test.com",
          phone: "1234567890",
          studentId: "STU004",
          departmentPrefs: ["Acting"],
          status: "SUBMITTED",
        },
      });

      const res = await EXPORT_GET(
        mockRequest(`/api/applicants/export`, { searchParams: { windowId: window.id } })
      );
      expect(res.status).toBe(200);
      const body = await res.text();
      // Formula injection chars are prefixed with '
      expect(body).toContain("'=SUM(A1:A10)");
      expect(body).toContain("'+attacker@test.com");
    });
  });

  // ===========================================================================
  // 2. REGISTRATION WINDOW — STATE MACHINE EDGE CASES
  // ===========================================================================
  describe("Registration Window — Status Transitions", () => {
    it("allows DRAFT→LIVE directly", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({
        data: {
          title: `RW Direct ${uniqueSuffix()}`,
          description: "Test description",
          status: "DRAFT",
          startDate: new Date("2020-01-01"),
          endDate: new Date("2030-12-31"),
        },
      });

      const res = await RW_PATCH(
        mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "LIVE" } }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("LIVE");
    });

    it("allows CLOSED→LIVE (reopen)", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({
        data: {
          title: `RW Reopen ${uniqueSuffix()}`,
          description: "Test description",
          status: "CLOSED",
          startDate: new Date("2020-01-01"),
          endDate: new Date("2030-12-31"),
        },
      });

      const res = await RW_PATCH(
        mockRequest(`/api/registration-windows/${rw.id}`, { method: "PATCH", body: { status: "LIVE" } }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("LIVE");
    });
  });

  // ===========================================================================
  // 3. PROMOTION — APPROVAL NOTIFICATION
  // ===========================================================================
  describe("Promotion — Approval Notification", () => {
    it("creates notification on promotion APPROVED", async () => {
      const { committee } = await setupAdmin(["promotion.approve"]);
      const promoUser = await createTestUser({ email: `promouser-${uniqueSuffix()}@test.com` });
      const promoMember = await createTestMember({ userId: promoUser.user.id, status: "ACTIVE" });

      const currentRole = await createTestRole({ name: `Current-${uniqueSuffix()}`, permissionIds: [] });
      const proposedRole = await createTestRole({ name: `Proposed-${uniqueSuffix()}`, permissionIds: [] });
      await assignCommitteeRole(promoMember.id, currentRole.id, committee.id);

      const promotion = await prisma.promotionRequest.create({
        data: {
          member: { connect: { id: promoMember.id } },
          currentRole: { connect: { id: currentRole.id } },
          proposedRole: { connect: { id: proposedRole.id } },
          reason: "Great work",
          status: "SUBMITTED",
          submittedBy: { connect: { id: promoUser.user.id } },
        },
      });

      const otherUser = await createTestUser({ email: `approver-${uniqueSuffix()}@test.com` });
      const otherMember = await createTestMember({ userId: otherUser.user.id, status: "ACTIVE" });
      const approveRole = await createTestRole({
        name: `Approver-${uniqueSuffix()}`,
        permissionIds: [(await prisma.permission.findUnique({ where: { key: "promotion.approve" } }))!.id],
      });
      await assignCommitteeRole(otherMember.id, approveRole.id, committee.id);
      mockAuth(otherUser.user.id, ["promotion.approve"]);

      // setup.ts mocks @/lib/notifications as a no-op; use the real implementation so we
      // can verify the full notification path end-to-end (same pattern as lib-unit tests).
      const realNotifs = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
      const { createNotification } = await import("@/lib/notifications");
      vi.mocked(createNotification).mockImplementationOnce(realNotifs.createNotification);

      const res = await PROMO_DECISION(
        mockRequest(`/api/promotions/${promotion.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
        { params: Promise.resolve({ id: promotion.id }) }
      );
      expect(res.status).toBe(200);

      const notification = await prisma.notification.findFirst({
        where: { userId: promoUser.user.id, type: "PROMOTION" },
      });
      expect(notification).not.toBeNull();
      expect(notification!.title).toContain("approved");
    });
  });

  // ===========================================================================
  // 4. EVENT STATUS TRANSITIONS
  // ===========================================================================
  describe("Event Status — Backward Transitions", () => {
    it("rejects ONGOING→DRAFT (backward)", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const event = await prisma.event.create({
        data: {
          title: `Ev Back ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "ONGOING",
          startAt: new Date("2020-01-01"),
          departmentId: dept.id,
        },
      });

      const res = await EVENT_PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { status: "DRAFT" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Cannot transition");
    });

    it("rejects COMPLETED→ONGOING (backward)", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const event = await prisma.event.create({
        data: {
          title: `Ev Completed ${uniqueSuffix()}`,
          type: "PERFORMANCE",
          status: "COMPLETED",
          startAt: new Date("2020-01-01"),
          departmentId: dept.id,
        },
      });

      const res = await EVENT_PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { status: "ONGOING" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("allows DRAFT→UPCOMING→ONGOING→COMPLETED", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const event = await prisma.event.create({
        data: {
          title: `Ev Flow ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "DRAFT",
          startAt: new Date("2030-01-01"),
          departmentId: dept.id,
        },
      });

      let res = await EVENT_PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { status: "UPCOMING" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(200);

      res = await EVENT_PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { status: "ONGOING" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(200);

      res = await EVENT_PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { status: "COMPLETED" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(200);

      const final = await prisma.event.findUnique({ where: { id: event.id } });
      expect(final!.status).toBe("COMPLETED");
    });

    it("allows CANCELLED from DRAFT, UPCOMING, or ONGOING", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });

      for (const from of ["DRAFT", "UPCOMING", "ONGOING"] as const) {
        const event = await prisma.event.create({
          data: {
            title: `Ev Cancel ${from} ${uniqueSuffix()}`,
            type: "WORKSHOP",
            status: from,
            startAt: new Date("2030-01-01"),
            departmentId: dept.id,
          },
        });
        const res = await EVENT_PATCH(
          mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { status: "CANCELLED" } }),
          { params: Promise.resolve({ id: event.id }) }
        );
        expect(res.status).toBe(200);
      }
    });

    it("rejects COMPLETED→CANCELLED", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const event = await prisma.event.create({
        data: {
          title: `Ev Cancel Done ${uniqueSuffix()}`,
          type: "PERFORMANCE",
          status: "COMPLETED",
          startAt: new Date("2020-01-01"),
          departmentId: dept.id,
        },
      });

      const res = await EVENT_PATCH(
        mockRequest(`/api/events/${event.id}`, { method: "PATCH", body: { status: "CANCELLED" } }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // 5. EVENT — DRAFT EXCLUSION
  // ===========================================================================
  describe("Event — DRAFT Exclusion", () => {
    it("GET /api/events excludes DRAFT events from list", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      await prisma.event.create({
        data: {
          title: `Draft Ev ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "DRAFT",
          startAt: new Date("2030-06-01"),
          departmentId: dept.id,
        },
      });
      await prisma.event.create({
        data: {
          title: `Published Ev ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "UPCOMING",
          startAt: new Date("2030-06-01"),
          departmentId: dept.id,
        },
      });

      const res = await EVENTS_GET(mockRequest("/api/events"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.events.some((e: { status: string }) => e.status === "DRAFT")).toBe(false);
      expect(body.events.some((e: { status: string }) => e.status === "UPCOMING")).toBe(true);
    });

    it("GET /api/events/:id returns 404 for DRAFT event", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const event = await prisma.event.create({
        data: {
          title: `Draft Only ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "DRAFT",
          startAt: new Date("2030-06-01"),
          departmentId: dept.id,
        },
      });

      const res = await EVENT_GET(
        mockRequest(`/api/events/${event.id}`),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("GET /api/public/events excludes DRAFT events", async () => {
      const dept = await createTestDepartment();
      await prisma.event.create({
        data: {
          title: `Public Draft ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "DRAFT",
          startAt: new Date("2030-06-01"),
          departmentId: dept.id,
        },
      });
      await prisma.event.create({
        data: {
          title: `Public Published ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "UPCOMING",
          startAt: new Date("2030-06-01"),
          departmentId: dept.id,
        },
      });

      const res = await PUBLIC_EVENTS(mockRequest("/api/public/events"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.every((e: { status: string }) => e.status !== "DRAFT")).toBe(true);
    });

    it("GET /api/public/events filters by upcoming=true (default)", async () => {
      const dept = await createTestDepartment();
      await prisma.event.create({
        data: {
          title: `Past Event ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "UPCOMING",
          startAt: new Date("2020-01-01"),
          departmentId: dept.id,
        },
      });
      await prisma.event.create({
        data: {
          title: `Future Event ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "UPCOMING",
          startAt: new Date("2099-01-01"),
          departmentId: dept.id,
        },
      });

      const res = await PUBLIC_EVENTS(mockRequest("/api/public/events"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.every((e: { startAt: string }) => new Date(e.startAt) >= new Date())).toBe(true);
    });

    it("GET /api/public/events with upcoming=false returns all non-draft", async () => {
      const dept = await createTestDepartment();
      await prisma.event.create({
        data: {
          title: `Past Event All ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "UPCOMING",
          startAt: new Date("2020-01-01"),
          departmentId: dept.id,
        },
      });

      const res = await PUBLIC_EVENTS(mockRequest("/api/public/events", { searchParams: { upcoming: "false" } }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // 6. MEMBER DASHBOARD — NO PROFILE
  // ===========================================================================
  describe("Member Dashboard — No Profile", () => {
    it("returns null member for user without member profile", async () => {
      const user = await createTestUser({ email: `noprofile-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, []);

      const res = await MEMBER_DASH();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.member).toBeNull();
      expect(body.departments).toEqual([]);
      expect(body.upcomingEvents).toEqual([]);
      expect(body.recentNotifications).toEqual([]);
      expect(body.user.id).toBe(user.user.id);
    });
  });

  // ===========================================================================
  // 7. CONTACT — EDGE CASES
  // ===========================================================================
  describe("Contact — Edge Cases", () => {
    it("handles missing x-forwarded-for header", async () => {
      const res = await CONTACT_POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "Test", email: "test@test.com", message: "This is a test message with enough chars" },
          headers: {},
        })
      );
      // Should still succeed (fallback IP)
      expect(res.status).toBe(201);
    });

    it("rejects name > 100 chars", async () => {
      const res = await CONTACT_POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "A".repeat(101), email: "test@test.com", message: "This is a test message with enough chars" },
        })
      );
      expect(res.status).toBe(400);
    });

    it("accepts name at exactly 100 chars", async () => {
      const res = await CONTACT_POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "A".repeat(100), email: "test@test.com", message: "This is a test message with enough chars" },
        })
      );
      expect(res.status).toBe(201);
    });

    it("strips XSS from name field", async () => {
      const res = await CONTACT_POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "<script>alert(1)</script>", email: "xss@test.com", message: "This is a test message with enough chars" },
        })
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.message).not.toContain("<script>");
    });

    it("rejects message < 10 chars", async () => {
      const res = await CONTACT_POST(
        mockRequest("/api/contact", {
          method: "POST",
          body: { name: "Test", email: "test@test.com", message: "Short" },
        })
      );
      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // 8. EVENT — endAt BEFORE startAt
  // ===========================================================================
  describe("Event — Date Validation", () => {
    it("rejects endAt before startAt on PATCH", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const event = await prisma.event.create({
        data: {
          title: `Ev Date ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "DRAFT",
          startAt: new Date("2030-06-01"),
          departmentId: dept.id,
        },
      });

      const res = await EVENT_PATCH(
        mockRequest(`/api/events/${event.id}`, {
          method: "PATCH",
          body: { startAt: "2030-06-10T10:00:00.000Z", endAt: "2030-06-01T10:00:00.000Z" },
        }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("endAt must be after startAt");
    });
  });

  // ===========================================================================
  // 9. REGISTRATION WINDOW — endDate BEFORE startDate
  // ===========================================================================
  describe("Registration Window — Date Validation", () => {
    it("rejects endDate before startDate on PATCH", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({
        data: {
          title: `RW Date ${uniqueSuffix()}`,
          description: "Test description",
          status: "DRAFT",
          startDate: new Date("2030-06-01"),
          endDate: new Date("2030-12-31"),
        },
      });

      const res = await RW_PATCH(
        mockRequest(`/api/registration-windows/${rw.id}`, {
          method: "PATCH",
          body: { startDate: "2030-06-10T00:00:00.000Z", endDate: "2030-06-01T00:00:00.000Z" },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("endDate must be after startDate");
    });

    it("rejects endDate equal to startDate", async () => {
      await setupAdmin();
      const rw = await prisma.registrationWindow.create({
        data: {
          title: `RW Equal ${uniqueSuffix()}`,
          description: "Test description",
          status: "DRAFT",
          startDate: new Date("2030-06-01"),
          endDate: new Date("2030-12-31"),
        },
      });

      const res = await RW_PATCH(
        mockRequest(`/api/registration-windows/${rw.id}`, {
          method: "PATCH",
          body: { startDate: "2030-06-01T00:00:00.000Z", endDate: "2030-06-01T00:00:00.000Z" },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // 10. EVENT — DEPARTMENT NOT FOUND
  // ===========================================================================
  describe("Event — Invalid Department Reference", () => {
    it("rejects PATCH with nonexistent departmentId", async () => {
      const { committee } = await setupAdmin();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const event = await prisma.event.create({
        data: {
          title: `Ev NoDept ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "DRAFT",
          startAt: new Date("2030-06-01"),
          departmentId: dept.id,
        },
      });

      const res = await EVENT_PATCH(
        mockRequest(`/api/events/${event.id}`, {
          method: "PATCH",
          body: { departmentId: NON_EXISTENT_CUID },
        }),
        { params: Promise.resolve({ id: event.id }) }
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("Department not found");
    });
  });

  // ===========================================================================
  // 11. NOTIFICATION — READ MARKS UNREAD
  // ===========================================================================
  describe("Notification — Read State", () => {
    it("notification starts unread (readAt=null), marking read sets readAt", async () => {
      const user = await createTestUser({ email: `notifstate-${uniqueSuffix()}@test.com` });
      const notif = await prisma.notification.create({
        data: {
          userId: user.user.id,
          type: "GENERAL",
          title: "Test",
          message: "Test notification",
        },
      });
      expect(notif.readAt).toBeNull();

      await prisma.notification.update({
        where: { id: notif.id },
        data: { readAt: new Date() },
      });

      const updated = await prisma.notification.findUnique({ where: { id: notif.id } });
      expect(updated!.readAt).not.toBeNull();
    });
  });

  // ===========================================================================
  // 12. SETTINGS — SINGLETON
  // ===========================================================================
  describe("Settings — Singleton Pattern", () => {
    it("settings PATCH creates row if none exists (upsert)", async () => {
      await setupAdmin();
      // Ensure clean state
      await prisma.systemSetting.deleteMany();

      // First PATCH creates
      const { PATCH: SETTINGS_PATCH } = await import("@/app/api/settings/route");
      const res1 = await SETTINGS_PATCH(
        mockRequest("/api/settings", { method: "PATCH", body: { clubName: "My Club" } })
      );
      expect(res1.status).toBe(200);

      // Second PATCH updates (upsert)
      const res2 = await SETTINGS_PATCH(
        mockRequest("/api/settings", { method: "PATCH", body: { clubName: "Updated Club" } })
      );
      expect(res2.status).toBe(200);
      const body = await res2.json();
      expect(body.message).toBe("Settings updated");
      expect(body.count).toBe(1);

      // Verify the value was actually updated
      const setting = await prisma.systemSetting.findUnique({ where: { key: "clubName" } });
      expect(setting).not.toBeNull();
      expect(setting!.value).toBe("Updated Club");

      // Only one row should exist
      const count = await prisma.systemSetting.count();
      expect(count).toBe(1);
    });
  });

  // ===========================================================================
  // 13. PUBLIC EVENTS — LIMIT
  // ===========================================================================
  describe("Public Events — Limit", () => {
    it("respects limit parameter", async () => {
      const dept = await createTestDepartment();
      for (let i = 0; i < 5; i++) {
        await prisma.event.create({
          data: {
            title: `Ev Limit ${i} ${uniqueSuffix()}`,
            type: "WORKSHOP",
            status: "UPCOMING",
            startAt: new Date(`2030-0${i + 1}-01`),
            departmentId: dept.id,
          },
        });
      }

      const res = await PUBLIC_EVENTS(
        mockRequest("/api/public/events", { searchParams: { limit: "3" } })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.length).toBeLessThanOrEqual(3);
    });

    it("caps limit at 100", async () => {
      const dept = await createTestDepartment();
      await prisma.event.create({
        data: {
          title: `Ev Cap ${uniqueSuffix()}`,
          type: "WORKSHOP",
          status: "UPCOMING",
          startAt: new Date("2030-06-01"),
          departmentId: dept.id,
        },
      });

      const res = await PUBLIC_EVENTS(
        mockRequest("/api/public/events", { searchParams: { limit: "500" } })
      );
      expect(res.status).toBe(200);
    });
  });

  // ===========================================================================
  // 14. PROMOTION — SELF-APPROVAL
  // ===========================================================================
  describe("Promotion — Self-Approval", () => {
    it("rejects self-approval of promotion", async () => {
      const { committee } = await setupAdmin(["promotion.approve", "promotion.submit"]);
      const promoUser = await createTestUser({ email: `selfpromo-${uniqueSuffix()}@test.com` });
      const promoMember = await createTestMember({ userId: promoUser.user.id, status: "ACTIVE" });

      const currentRole = await createTestRole({ name: `SelfCurrent-${uniqueSuffix()}`, permissionIds: [] });
      const proposedRole = await createTestRole({ name: `SelfProposed-${uniqueSuffix()}`, permissionIds: [] });
      // Assign promoMember a role WITH promotion.approve so can() passes
      const selfApproveRole = await createTestRole({
        name: `SelfApprover-${uniqueSuffix()}`,
        permissionIds: [
          (await prisma.permission.findUnique({ where: { key: "promotion.approve" } }))!.id,
          (await prisma.permission.findUnique({ where: { key: "promotion.submit" } }))!.id,
        ],
      });
      await assignCommitteeRole(promoMember.id, selfApproveRole.id, committee.id);

      const promotion = await prisma.promotionRequest.create({
        data: {
          member: { connect: { id: promoMember.id } },
          currentRole: { connect: { id: currentRole.id } },
          proposedRole: { connect: { id: proposedRole.id } },
          reason: "Promote myself",
          status: "SUBMITTED",
          submittedBy: { connect: { id: promoUser.user.id } },
        },
      });

      mockAuth(promoUser.user.id, ["promotion.approve", "promotion.submit"]);

      const res = await PROMO_DECISION(
        mockRequest(`/api/promotions/${promotion.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
        { params: Promise.resolve({ id: promotion.id }) }
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain("cannot approve your own");
    });
  });

  // ===========================================================================
  // 15. PROMOTION — NOT IN REVIEWABLE STATE
  // ===========================================================================
  describe("Promotion — Invalid State Transitions", () => {
    it("rejects decision on DRAFT promotion", async () => {
      const { committee } = await setupAdmin(["promotion.approve"]);
      const promoUser = await createTestUser({ email: `draftpromo-${uniqueSuffix()}@test.com` });
      const promoMember = await createTestMember({ userId: promoUser.user.id, status: "ACTIVE" });

      const currentRole = await createTestRole({ name: `DraftCur-${uniqueSuffix()}`, permissionIds: [] });
      const proposedRole = await createTestRole({ name: `DraftProp-${uniqueSuffix()}`, permissionIds: [] });
      await assignCommitteeRole(promoMember.id, currentRole.id, committee.id);

      const promotion = await prisma.promotionRequest.create({
        data: {
          member: { connect: { id: promoMember.id } },
          currentRole: { connect: { id: currentRole.id } },
          proposedRole: { connect: { id: proposedRole.id } },
          reason: "Draft",
          status: "DRAFT",
          submittedBy: { connect: { id: promoUser.user.id } },
        },
      });

      const otherUser = await createTestUser({ email: `decider-${uniqueSuffix()}@test.com` });
      const otherMember = await createTestMember({ userId: otherUser.user.id, status: "ACTIVE" });
      await assignCommitteeRole(otherMember.id, (await prisma.role.findFirst({ where: { name: { contains: "Admin" } } }))!.id, committee.id);
      mockAuth(otherUser.user.id, ["promotion.approve"]);

      const res = await PROMO_DECISION(
        mockRequest(`/api/promotions/${promotion.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
        { params: Promise.resolve({ id: promotion.id }) }
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("not in a reviewable state");
    });

    it("rejects decision on REJECTED promotion", async () => {
      const { committee } = await setupAdmin(["promotion.approve"]);
      const promoUser = await createTestUser({ email: `rejpromo-${uniqueSuffix()}@test.com` });
      const promoMember = await createTestMember({ userId: promoUser.user.id, status: "ACTIVE" });

      const currentRole = await createTestRole({ name: `RejCur-${uniqueSuffix()}`, permissionIds: [] });
      const proposedRole = await createTestRole({ name: `RejProp-${uniqueSuffix()}`, permissionIds: [] });
      await assignCommitteeRole(promoMember.id, currentRole.id, committee.id);

      const promotion = await prisma.promotionRequest.create({
        data: {
          member: { connect: { id: promoMember.id } },
          currentRole: { connect: { id: currentRole.id } },
          proposedRole: { connect: { id: proposedRole.id } },
          reason: "Already rejected",
          status: "REJECTED",
          submittedBy: { connect: { id: promoUser.user.id } },
        },
      });

      const otherUser = await createTestUser({ email: `rejdecider-${uniqueSuffix()}@test.com` });
      const otherMember = await createTestMember({ userId: otherUser.user.id, status: "ACTIVE" });
      await assignCommitteeRole(otherMember.id, (await prisma.role.findFirst({ where: { name: { contains: "Admin" } } }))!.id, committee.id);
      mockAuth(otherUser.user.id, ["promotion.approve"]);

      const res = await PROMO_DECISION(
        mockRequest(`/api/promotions/${promotion.id}/decision`, { method: "POST", body: { status: "APPROVED" } }),
        { params: Promise.resolve({ id: promotion.id }) }
      );
      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // 16. EVENT — NONEXISTENT EVENT
  // ===========================================================================
  describe("Event — Nonexistent", () => {
    it("GET /api/events/:id returns 404 for nonexistent event", async () => {
      await setupAdmin();
      const res = await EVENT_GET(
        mockRequest(`/api/events/${NON_EXISTENT_CUID}`),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(404);
    });

    it("PATCH /api/events/:id returns 404 for nonexistent event", async () => {
      await setupAdmin();
      const res = await EVENT_PATCH(
        mockRequest(`/api/events/${NON_EXISTENT_CUID}`, { method: "PATCH", body: { title: "Updated" } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(404);
    });
  });

  // ===========================================================================
  // 17. REGISTRATION WINDOW — NONEXISTENT
  // ===========================================================================
  describe("Registration Window — Nonexistent", () => {
    it("PATCH /api/registration-windows/:id returns 404", async () => {
      await setupAdmin();
      const res = await RW_PATCH(
        mockRequest(`/api/registration-windows/${NON_EXISTENT_CUID}`, { method: "PATCH", body: { title: "X" } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(404);
    });
  });

  // ===========================================================================
  // 18. PROMOTION — NONEXISTENT
  // ===========================================================================
  describe("Promotion — Nonexistent", () => {
    it("POST /api/promotions/:id/decision returns 404", async () => {
      await setupAdmin(["promotion.approve"]);
      const res = await PROMO_DECISION(
        mockRequest(`/api/promotions/${NON_EXISTENT_CUID}/decision`, { method: "POST", body: { status: "APPROVED" } }),
        { params: Promise.resolve({ id: NON_EXISTENT_CUID }) }
      );
      expect(res.status).toBe(404);
    });
  });
});
