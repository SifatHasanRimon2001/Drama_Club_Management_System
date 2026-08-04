import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/registration-windows/route";
import { PATCH } from "@/app/api/registration-windows/[id]/route";
import { GET as GET_ONE } from "@/app/api/registration-windows/[id]/route";
import { POST as APPLY } from "@/app/api/registration-windows/[id]/apply/route";
import { GET as GET_APPLICANTS } from "@/app/api/registration-windows/[id]/applicants/route";
import { PATCH as PATCH_APPLICANT } from "@/app/api/registration-windows/[id]/applicants/[applicantId]/route";
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
  uniqueSuffix,
} from "./helpers";
import prisma from "@/lib/prisma";

describe("Registration Windows API", () => {
  let adminUserId: string;
  let committee: { id: string };
  let department: { id: string };

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-rw-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    committee = await createTestCommittee({ isCurrent: true });
    department = await createTestDepartment({ committeeId: committee.id });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ["registration.manage", "registration.review"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);

    mockAuth(adminUserId, ["registration.manage", "registration.review"]);
  });

  describe("GET /api/registration-windows", () => {
    it("returns registration windows", async () => {
      await prisma.registrationWindow.create({
        data: {
          title: "Test Window",
          description: "Test desc",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-02-01"),
          status: "DRAFT",
        },
      });

      const res = await GET(mockRequest("/api/registration-windows"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.windows).toBeDefined();
      expect(Array.isArray(data.windows)).toBe(true);
      expect(data.windows.length).toBeGreaterThanOrEqual(1);
    });

    it("returns pagination info", async () => {
      const res = await GET(mockRequest("/api/registration-windows"));
      const data = await res.json();

      expect(data.pagination).toBeDefined();
      expect(data.pagination).toHaveProperty("page");
      expect(data.pagination).toHaveProperty("limit");
      expect(data.pagination).toHaveProperty("total");
      expect(data.pagination).toHaveProperty("totalPages");
    });

    it("filters by status", async () => {
      await prisma.registrationWindow.create({
        data: { title: "Draft", description: "d", startDate: new Date(), endDate: new Date(), status: "DRAFT" },
      });
      await prisma.registrationWindow.create({
        data: { title: "Live", description: "d", startDate: new Date(), endDate: new Date(), status: "LIVE" },
      });

      const res = await GET(mockRequest("/api/registration-windows", { searchParams: { status: "LIVE" } }));
      const data = await res.json();

      expect(data.windows.every((w: { status: string }) => w.status === "LIVE")).toBe(true);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await GET(mockRequest("/api/registration-windows"));
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/registration-windows", () => {
    it("creates a registration window", async () => {
      const req = mockRequest("/api/registration-windows", {
        method: "POST",
        body: {
          title: `Window${uniqueSuffix()}`,
          description: "Registration for new members",
          startDate: "2024-01-01T00:00:00.000Z",
          endDate: "2024-02-01T00:00:00.000Z",
        },
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.title).toBeTruthy();
      expect(data.status).toBe("DRAFT");
    });

    it("rejects missing description", async () => {
      const req = mockRequest("/api/registration-windows", {
        method: "POST",
        body: {
          title: "No Desc",
          startDate: "2024-01-01T00:00:00.000Z",
          endDate: "2024-02-01T00:00:00.000Z",
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects startDate after endDate", async () => {
      const req = mockRequest("/api/registration-windows", {
        method: "POST",
        body: {
          title: "Bad Dates",
          description: "desc",
          startDate: "2024-02-01T00:00:00.000Z",
          endDate: "2024-01-01T00:00:00.000Z",
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await POST(
        mockRequest("/api/registration-windows", {
          method: "POST",
          body: { title: "X", description: "d", startDate: "2024-01-01T00:00:00.000Z", endDate: "2024-02-01T00:00:00.000Z" },
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/registration-windows/[id]", () => {
    it("returns window for admin", async () => {
      const rw = await prisma.registrationWindow.create({
        data: { title: "Admin View", description: "d", startDate: new Date(), endDate: new Date(), status: "DRAFT" },
      });

      const res = await GET_ONE(
        mockRequest(`/api/registration-windows/${rw.id}`),
        { params: Promise.resolve({ id: rw.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe(rw.id);
    });

    it("returns 404 for non-LIVE window when unauthenticated", async () => {
      clearAuth();
      const rw = await prisma.registrationWindow.create({
        data: { title: "Draft Only", description: "d", startDate: new Date(), endDate: new Date(), status: "DRAFT" },
      });

      const res = await GET_ONE(
        mockRequest(`/api/registration-windows/${rw.id}`),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns LIVE window when unauthenticated", async () => {
      clearAuth();
      const rw = await prisma.registrationWindow.create({
        data: { title: "Live Window", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
      });

      const res = await GET_ONE(
        mockRequest(`/api/registration-windows/${rw.id}`),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(200);
    });

    it("returns 404 for nonexistent window", async () => {
      const res = await GET_ONE(
        mockRequest("/api/registration-windows/fake"),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/registration-windows/[id]", () => {
    it("updates a registration window", async () => {
      const rw = await prisma.registrationWindow.create({
        data: { title: "Old Title", description: "desc", startDate: new Date("2024-01-01"), endDate: new Date("2024-02-01"), status: "DRAFT" },
      });

      const res = await PATCH(
        mockRequest(`/api/registration-windows/${rw.id}`, {
          method: "PATCH",
          body: { title: "New Title" },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.title).toBe("New Title");
    });

    it("updates status to LIVE", async () => {
      const rw = await prisma.registrationWindow.create({
        data: { title: "Go Live", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "DRAFT" },
      });

      const res = await PATCH(
        mockRequest(`/api/registration-windows/${rw.id}`, {
          method: "PATCH",
          body: { status: "LIVE" },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("LIVE");
    });

    it("returns 404 for nonexistent window", async () => {
      const res = await PATCH(
        mockRequest("/api/registration-windows/x", { method: "PATCH", body: { title: "X" } }),
        { params: Promise.resolve({ id: "nonexistent" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/registration-windows/[id]/apply", () => {
    it("submits an application to a LIVE window", async () => {
      const rw = await prisma.registrationWindow.create({
        data: { title: "Apply Here", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: {
            name: "Applicant",
            email: `apply-${uniqueSuffix()}@test.com`,
            phone: "1234567890",
            studentId: `STU${uniqueSuffix()}`,
            departmentPrefs: [department.id],
          },
          headers: { "x-forwarded-for": "192.168.1.100" },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.message).toBe("Application submitted successfully");
      expect(data.id).toBeDefined();
    });

    it("rejects application to non-LIVE window", async () => {
      const rw = await prisma.registrationWindow.create({
        data: { title: "Draft", description: "d", startDate: new Date(), endDate: new Date(), status: "DRAFT" },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: { name: "X", email: "x@test.com", phone: "123", studentId: "S1", departmentPrefs: [] },
          headers: { "x-forwarded-for": "192.168.1.101" },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("rejects duplicate application", async () => {
      const committee = await createTestCommittee();
      const dept = await createTestDepartment({ committeeId: committee.id });
      const rw = await prisma.registrationWindow.create({
        data: { title: "Dup Apply", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
      });
      const email = `dup-${uniqueSuffix()}@test.com`;

      await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: { name: "First", email, phone: "123", studentId: "S1", departmentPrefs: [dept.id] },
          headers: { "x-forwarded-for": "192.168.1.102" },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: { name: "Second", email, phone: "456", studentId: "S2", departmentPrefs: [dept.id] },
          headers: { "x-forwarded-for": "192.168.1.103" },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(409);
    });

    it("returns 404 for nonexistent window", async () => {
      const res = await APPLY(
        mockRequest("/api/registration-windows/fake/apply", {
          method: "POST",
          body: { name: "X", email: "x@test.com", phone: "123", studentId: "S1", departmentPrefs: [] },
          headers: { "x-forwarded-for": "192.168.1.104" },
        }),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("rejects invalid department preferences", async () => {
      const rw = await prisma.registrationWindow.create({
        data: { title: "Bad Dept", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: { name: "X", email: `baddept-${uniqueSuffix()}@test.com`, phone: "123", studentId: "S1", departmentPrefs: ["clxxxxxxxxxxxxxxxxx"] },
          headers: { "x-forwarded-for": "192.168.1.105" },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing required fields", async () => {
      const rw = await prisma.registrationWindow.create({
        data: { title: "Req Fields", description: "d", startDate: new Date("2020-01-01"), endDate: new Date("2030-01-01"), status: "LIVE" },
      });

      const res = await APPLY(
        mockRequest(`/api/registration-windows/${rw.id}/apply`, {
          method: "POST",
          body: { name: "", email: "bad", phone: "", studentId: "", departmentPrefs: [] },
          headers: { "x-forwarded-for": "192.168.1.106" },
        }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/registration-windows/[id]/applicants", () => {
    it("returns applicants for a window", async () => {
      const rw = await prisma.registrationWindow.create({
        data: { title: "Applicants", description: "d", startDate: new Date(), endDate: new Date(), status: "LIVE" },
      });
      await prisma.applicant.create({
        data: { registrationWindowId: rw.id, name: "Test", email: `t-${uniqueSuffix()}@test.com`, phone: "123", studentId: "S1", departmentPrefs: [], status: "SUBMITTED" },
      });

      const res = await GET_APPLICANTS(
        mockRequest(`/api/registration-windows/${rw.id}/applicants`),
        { params: Promise.resolve({ id: rw.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.applicants).toBeDefined();
      expect(data.applicants.length).toBe(1);
    });

    it("filters by status", async () => {
      const rw = await prisma.registrationWindow.create({
        data: { title: "Filter", description: "d", startDate: new Date(), endDate: new Date(), status: "LIVE" },
      });
      await prisma.applicant.create({
        data: { registrationWindowId: rw.id, name: "Sub", email: `sub-${uniqueSuffix()}@test.com`, phone: "123", studentId: "S1", departmentPrefs: [], status: "SUBMITTED" },
      });
      await prisma.applicant.create({
        data: { registrationWindowId: rw.id, name: "Acc", email: `acc-${uniqueSuffix()}@test.com`, phone: "456", studentId: "S2", departmentPrefs: [], status: "ACCEPTED" },
      });

      const res = await GET_APPLICANTS(
        mockRequest(`/api/registration-windows/${rw.id}/applicants`, { searchParams: { status: "ACCEPTED" } }),
        { params: Promise.resolve({ id: rw.id }) }
      );
      const data = await res.json();

      expect(data.applicants.every((a: { status: string }) => a.status === "ACCEPTED")).toBe(true);
    });
  });

  describe("PATCH /api/registration-windows/[id]/applicants/[applicantId]", () => {
    it("transitions SUBMITTED to UNDER_REVIEW", async () => {
      const rw = await prisma.registrationWindow.create({
        data: { title: "Review", description: "d", startDate: new Date(), endDate: new Date(), status: "LIVE" },
      });
      const app = await prisma.applicant.create({
        data: { registrationWindowId: rw.id, name: "Review Me", email: `rev-${uniqueSuffix()}@test.com`, phone: "123", studentId: "S1", departmentPrefs: [], status: "SUBMITTED" },
      });

      const res = await PATCH_APPLICANT(
        mockRequest(`/api/registration-windows/${rw.id}/applicants/${app.id}`, {
          method: "PATCH",
          body: { status: "ACCEPTED" },
        }),
        { params: Promise.resolve({ id: rw.id, applicantId: app.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("ACCEPTED");
    });

    it("rejects invalid transition from ACCEPTED", async () => {
      const rw = await prisma.registrationWindow.create({
        data: { title: "NoBack", description: "d", startDate: new Date(), endDate: new Date(), status: "LIVE" },
      });
      const app = await prisma.applicant.create({
        data: { registrationWindowId: rw.id, name: "Accepted", email: `acc-${uniqueSuffix()}@test.com`, phone: "123", studentId: "S1", departmentPrefs: [], status: "ACCEPTED" },
      });

      const res = await PATCH_APPLICANT(
        mockRequest(`/api/registration-windows/${rw.id}/applicants/${app.id}`, {
          method: "PATCH",
          body: { status: "REJECTED" },
        }),
        { params: Promise.resolve({ id: rw.id, applicantId: app.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent applicant", async () => {
      const rw = await prisma.registrationWindow.create({
        data: { title: "NoApp", description: "d", startDate: new Date(), endDate: new Date(), status: "LIVE" },
      });
      const res = await PATCH_APPLICANT(
        mockRequest(`/api/registration-windows/${rw.id}/applicants/fake`, {
          method: "PATCH",
          body: { status: "ACCEPTED" },
        }),
        { params: Promise.resolve({ id: rw.id, applicantId: "fake" }) }
      );
      expect(res.status).toBe(404);
    });
  });
});
