import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/applicants/route";
import { GET as GET_ONE, PATCH } from "@/app/api/applicants/[id]/route";
import { POST as CONVERT } from "@/app/api/applicants/[id]/convert/route";
import { GET as EXPORT_CSV } from "@/app/api/applicants/export/route";
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

describe("Applicants API", () => {
  let adminUserId: string;
  let committee: { id: string };
  let department: { id: string };

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-a-${uniqueSuffix()}@test.com` });
    adminUserId = admin.user.id;
    const member = await createTestMember({ userId: adminUserId, status: "ACTIVE" });
    committee = await createTestCommittee({ isCurrent: true });
    department = await createTestDepartment({ committeeId: committee.id });
    const adminRole = await createTestRole({
      name: "Admin",
      permissionIds: (
        await Promise.all(
          ["registration.review", "registration.manage", "member.create"].map(async (k) => {
            const p = await prisma.permission.findUnique({ where: { key: k } });
            return p!.id;
          })
        )
      ),
    });
    await assignCommitteeRole(member.id, adminRole.id, committee.id);

    mockAuth(adminUserId, ["registration.review", "registration.manage", "member.create"]);
  });

  async function createTestApplicant(data?: { status?: string; windowId?: string }) {
    const window = data?.windowId
      ? await prisma.registrationWindow.findUnique({ where: { id: data.windowId } })
      : await prisma.registrationWindow.create({
          data: {
            title: `Window${uniqueSuffix()}`,
            description: "Test",
            startDate: new Date("2024-01-01"),
            endDate: new Date("2024-12-31"),
            status: "LIVE",
          },
        });

    const suffix = uniqueSuffix();
    return prisma.applicant.create({
      data: {
        registrationWindowId: window!.id,
        name: `Applicant${suffix}`,
        email: `app-${suffix}@test.com`,
        phone: "1234567890",
        studentId: `STU${suffix}`,
        departmentPrefs: [department.id],
        status: (data?.status as "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "CONVERTED") || "SUBMITTED",
      },
    });
  }

  describe("GET /api/applicants", () => {
    it("returns applicants list", async () => {
      await createTestApplicant();
      const res = await GET(mockRequest("/api/applicants"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.applicants).toBeDefined();
      expect(data.applicants.length).toBeGreaterThanOrEqual(1);
    });

    it("returns pagination info", async () => {
      const res = await GET(mockRequest("/api/applicants"));
      const data = await res.json();

      expect(data.pagination).toBeDefined();
      expect(data.pagination).toHaveProperty("total");
    });

    it("filters by status", async () => {
      await createTestApplicant({ status: "ACCEPTED" });
      await createTestApplicant({ status: "SUBMITTED" });

      const res = await GET(
        mockRequest("/api/applicants", { searchParams: { status: "ACCEPTED" } })
      );
      const data = await res.json();

      expect(data.applicants.every((a: { status: string }) => a.status === "ACCEPTED")).toBe(true);
    });

    it("searches by name", async () => {
      const unique = uniqueSuffix();
      await prisma.applicant.create({
        data: {
          registrationWindowId: (await prisma.registrationWindow.create({
            data: { title: `W${unique}`, description: "d", startDate: new Date(), endDate: new Date(), status: "LIVE" },
          })).id,
          name: `Searchable${unique}`,
          email: `search-${unique}@test.com`,
          phone: "123",
          studentId: `STU${unique}`,
          departmentPrefs: [],
          status: "SUBMITTED",
        },
      });

      const res = await GET(
        mockRequest("/api/applicants", { searchParams: { search: `Searchable${unique}` } })
      );
      const data = await res.json();

      expect(data.applicants.length).toBe(1);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await GET(mockRequest("/api/applicants"));
      expect(res.status).toBe(401);
    });

    it("returns 403 when missing registration.review", async () => {
      const user = await createTestUser({ email: `noperm-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, []);
      const res = await GET(mockRequest("/api/applicants"));
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/applicants/[id]", () => {
    it("returns a single applicant", async () => {
      const app = await createTestApplicant();
      const res = await GET_ONE(
        mockRequest(`/api/applicants/${app.id}`),
        { params: Promise.resolve({ id: app.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe(app.id);
      expect(data).toHaveProperty("registrationWindow");
    });

    it("returns 404 for nonexistent applicant", async () => {
      const res = await GET_ONE(
        mockRequest("/api/applicants/fake"),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/applicants/[id] - status transitions", () => {
    it("accepts SUBMITTED -> ACCEPTED", async () => {
      const app = await createTestApplicant({ status: "SUBMITTED" });
      const res = await PATCH(
        mockRequest(`/api/applicants/${app.id}`, {
          method: "PATCH",
          body: { status: "ACCEPTED" },
        }),
        { params: Promise.resolve({ id: app.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("ACCEPTED");
    });

    it("accepts SUBMITTED -> REJECTED", async () => {
      const app = await createTestApplicant({ status: "SUBMITTED" });
      const res = await PATCH(
        mockRequest(`/api/applicants/${app.id}`, {
          method: "PATCH",
          body: { status: "REJECTED" },
        }),
        { params: Promise.resolve({ id: app.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("REJECTED");
    });

    it("rejects invalid status (UNDER_REVIEW not in schema)", async () => {
      const app = await createTestApplicant({ status: "SUBMITTED" });
      const res = await PATCH(
        mockRequest(`/api/applicants/${app.id}`, {
          method: "PATCH",
          body: { status: "UNDER_REVIEW" },
        }),
        { params: Promise.resolve({ id: app.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("rejects ACCEPTED -> SUBMITTED (backward transition)", async () => {
      const app = await createTestApplicant({ status: "ACCEPTED" });
      const res = await PATCH(
        mockRequest(`/api/applicants/${app.id}`, {
          method: "PATCH",
          body: { status: "SUBMITTED" },
        }),
        { params: Promise.resolve({ id: app.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("rejects REJECTED -> ACCEPTED", async () => {
      const app = await createTestApplicant({ status: "REJECTED" });
      const res = await PATCH(
        mockRequest(`/api/applicants/${app.id}`, {
          method: "PATCH",
          body: { status: "ACCEPTED" },
        }),
        { params: Promise.resolve({ id: app.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent applicant", async () => {
      const res = await PATCH(
        mockRequest("/api/applicants/fake", { method: "PATCH", body: { status: "ACCEPTED" } }),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/applicants/[id]/convert", () => {
    it("converts an accepted applicant to a member", async () => {
      const app = await createTestApplicant({ status: "ACCEPTED" });

      const res = await CONVERT(
        mockRequest(`/api/applicants/${app.id}/convert`, {
          method: "POST",
          body: { password: "password123" },
        }),
        { params: Promise.resolve({ id: app.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.member).toBeDefined();
      expect(data.message).toBe("Applicant converted to member");

      const member = await prisma.member.findUnique({ where: { id: data.member.id } });
      expect(member).not.toBeNull();
      expect(member!.status).toBe("ACTIVE");

      const deptAssignment = await prisma.memberDepartment.findFirst({
        where: { memberId: data.member.id, departmentId: department.id },
      });
      expect(deptAssignment).not.toBeNull();

      const updatedApp = await prisma.applicant.findUnique({ where: { id: app.id } });
      expect(updatedApp!.status).toBe("CONVERTED");
    });

    it("generates temp password when none provided", async () => {
      const app = await createTestApplicant({ status: "ACCEPTED" });

      const res = await CONVERT(
        mockRequest(`/api/applicants/${app.id}/convert`, {
          method: "POST",
          body: {},
        }),
        { params: Promise.resolve({ id: app.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.tempPassword).toBeDefined();
      expect(data.tempPassword.length).toBeGreaterThan(8);
    });

    it("rejects converting a non-accepted applicant", async () => {
      const app = await createTestApplicant({ status: "SUBMITTED" });
      const res = await CONVERT(
        mockRequest(`/api/applicants/${app.id}/convert`, {
          method: "POST",
          body: { password: "password123" },
        }),
        { params: Promise.resolve({ id: app.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent applicant", async () => {
      const res = await CONVERT(
        mockRequest("/api/applicants/fake/convert", {
          method: "POST",
          body: { password: "password123" },
        }),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 409 if already converted", async () => {
      const app = await createTestApplicant({ status: "ACCEPTED" });

      await CONVERT(
        mockRequest(`/api/applicants/${app.id}/convert`, {
          method: "POST",
          body: { password: "password123" },
        }),
        { params: Promise.resolve({ id: app.id }) }
      );

      const res = await CONVERT(
        mockRequest(`/api/applicants/${app.id}/convert`, {
          method: "POST",
          body: { password: "password123" },
        }),
        { params: Promise.resolve({ id: app.id }) }
      );
      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/applicants/export", () => {
    it("exports applicants as CSV", async () => {
      const rw = await prisma.registrationWindow.create({
        data: { title: "Export", description: "d", startDate: new Date(), endDate: new Date(), status: "LIVE" },
      });
      await prisma.applicant.create({
        data: { registrationWindowId: rw.id, name: "Export Me", email: `export-${uniqueSuffix()}@test.com`, phone: "123", studentId: "S1", departmentPrefs: [], status: "SUBMITTED" },
      });

      const res = await EXPORT_CSV(
        mockRequest("/api/applicants/export", { searchParams: { windowId: rw.id } })
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/csv");
      expect(res.headers.get("content-disposition")).toContain("attachment");
    });

    it("returns 400 when windowId is missing", async () => {
      const res = await EXPORT_CSV(mockRequest("/api/applicants/export"));
      expect(res.status).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await EXPORT_CSV(
        mockRequest("/api/applicants/export", { searchParams: { windowId: "x" } })
      );
      expect(res.status).toBe(401);
    });
  });
});
