import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/promotions/route";
import { GET as GET_ONE } from "@/app/api/promotions/[id]/route";
import { POST as SUBMIT } from "@/app/api/promotions/[id]/submit/route";
import { POST as DECISION } from "@/app/api/promotions/[id]/decision/route";
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
  uniqueSuffix,
} from "./helpers";
import prisma from "@/lib/prisma";

describe("Promotions API", () => {
  let adminUserId: string;
  let committee: { id: string };

  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();

    const admin = await createTestUser({ email: `admin-p-${uniqueSuffix()}@test.com` });
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

  async function createTestData() {
    const subjectUser = await createTestUser({ email: `subject-${uniqueSuffix()}@test.com` });
    const subjectMember = await createTestMember({ userId: subjectUser.user.id, status: "ACTIVE" });

    const currentRole = await createTestRole({ name: `CurrentRole${uniqueSuffix()}` });
    const proposedRole = await createTestRole({ name: `ProposedRole${uniqueSuffix()}` });

    await assignCommitteeRole(subjectMember.id, currentRole.id, committee.id);

    return { subjectUser, subjectMember, currentRole, proposedRole };
  }

  describe("GET /api/promotions", () => {
    it("returns promotions list", async () => {
      const { subjectMember, currentRole, proposedRole } = await createTestData();

      await prisma.promotionRequest.create({
        data: {
          memberId: subjectMember.id,
          currentRoleId: currentRole.id,
          proposedRoleId: proposedRole.id,
          reason: "Test promotion",
          submittedById: adminUserId,
          status: "SUBMITTED",
        },
      });

      const res = await GET(mockRequest("/api/promotions"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.promotions).toBeDefined();
      expect(data.promotions.length).toBeGreaterThanOrEqual(1);
    });

    it("returns pagination info", async () => {
      const res = await GET(mockRequest("/api/promotions"));
      const data = await res.json();
      expect(data.pagination).toBeDefined();
    });

    it("filters by status", async () => {
      const { subjectMember, currentRole, proposedRole } = await createTestData();
      await prisma.promotionRequest.create({
        data: { memberId: subjectMember.id, currentRoleId: currentRole.id, proposedRoleId: proposedRole.id, reason: "Test", submittedById: adminUserId, status: "DRAFT" },
      });

      const res = await GET(mockRequest("/api/promotions", { searchParams: { status: "DRAFT" } }));
      const data = await res.json();
      expect(data.promotions.every((p: { status: string }) => p.status === "DRAFT")).toBe(true);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await GET(mockRequest("/api/promotions"));
      expect(res.status).toBe(401);
    });

    it("returns 403 when missing both permissions", async () => {
      const user = await createTestUser({ email: `noperm-${uniqueSuffix()}@test.com` });
      mockAuth(user.user.id, []);
      const res = await GET(mockRequest("/api/promotions"));
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/promotions", () => {
    it("creates a promotion request with DRAFT status", async () => {
      const { subjectMember, currentRole, proposedRole } = await createTestData();

      const res = await POST(
        mockRequest("/api/promotions", {
          method: "POST",
          body: {
            memberId: subjectMember.id,
            currentRoleId: currentRole.id,
            proposedRoleId: proposedRole.id,
            reason: "Great performance",
          },
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.status).toBe("DRAFT");
      expect(data.reason).toBe("Great performance");
    });

    it("rejects missing reason", async () => {
      const { subjectMember, currentRole, proposedRole } = await createTestData();

      const res = await POST(
        mockRequest("/api/promotions", {
          method: "POST",
          body: {
            memberId: subjectMember.id,
            currentRoleId: currentRole.id,
            proposedRoleId: proposedRole.id,
          },
        })
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent member", async () => {
      const { currentRole, proposedRole } = await createTestData();
      const res = await POST(
        mockRequest("/api/promotions", {
          method: "POST",
          body: { memberId: "cl00000000000000000000000", currentRoleId: currentRole.id, proposedRoleId: proposedRole.id, reason: "Test" },
        })
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const res = await POST(
        mockRequest("/api/promotions", {
          method: "POST",
          body: { memberId: "x", currentRoleId: "y", proposedRoleId: "z", reason: "Test" },
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/promotions/[id]/submit", () => {
    it("submits a draft promotion", async () => {
      const { subjectMember, currentRole, proposedRole } = await createTestData();

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

    it("rejects submitting a non-draft promotion", async () => {
      const { subjectMember, currentRole, proposedRole } = await createTestData();

      const promo = await prisma.promotionRequest.create({
        data: {
          memberId: subjectMember.id,
          currentRoleId: currentRole.id,
          proposedRoleId: proposedRole.id,
          reason: "Test",
          submittedById: adminUserId,
          status: "SUBMITTED",
        },
      });

      const res = await SUBMIT(
        mockRequest(`/api/promotions/${promo.id}/submit`, { method: "POST" }),
        { params: Promise.resolve({ id: promo.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 when user is not member, sponsor, or approver", async () => {
      const { subjectMember, currentRole, proposedRole } = await createTestData();
      const outsider = await createTestUser({ email: `outsider-${uniqueSuffix()}@test.com` });
      const outsiderMember = await createTestMember({ userId: outsider.user.id });
      const outsiderRole = await createTestRole({ name: `Outsider-${uniqueSuffix()}` });
      await assignCommitteeRole(outsiderMember.id, outsiderRole.id, committee.id);

      mockAuth(outsider.user.id, ["promotion.submit"]);

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
      expect(res.status).toBe(403);
    });

    it("returns 404 for nonexistent promotion", async () => {
      const res = await SUBMIT(
        mockRequest("/api/promotions/fake/submit", { method: "POST" }),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/promotions/[id]/decision", () => {
    it("approves a submitted promotion", async () => {
      const { subjectMember, currentRole, proposedRole } = await createTestData();

      const promo = await prisma.promotionRequest.create({
        data: {
          memberId: subjectMember.id,
          currentRoleId: currentRole.id,
          proposedRoleId: proposedRole.id,
          reason: "Test",
          submittedById: adminUserId,
          status: "SUBMITTED",
        },
      });

      const res = await DECISION(
        mockRequest(`/api/promotions/${promo.id}/decision`, {
          method: "POST",
          body: { status: "APPROVED" },
        }),
        { params: Promise.resolve({ id: promo.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("APPROVED");
    });

    it("rejects a submitted promotion", async () => {
      const { subjectMember, currentRole, proposedRole } = await createTestData();

      const promo = await prisma.promotionRequest.create({
        data: {
          memberId: subjectMember.id,
          currentRoleId: currentRole.id,
          proposedRoleId: proposedRole.id,
          reason: "Test",
          submittedById: adminUserId,
          status: "SUBMITTED",
        },
      });

      const res = await DECISION(
        mockRequest(`/api/promotions/${promo.id}/decision`, {
          method: "POST",
          body: { status: "REJECTED" },
        }),
        { params: Promise.resolve({ id: promo.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("REJECTED");
    });

    it("rejects approving an already approved promotion", async () => {
      const { subjectMember, currentRole, proposedRole } = await createTestData();

      const promo = await prisma.promotionRequest.create({
        data: {
          memberId: subjectMember.id,
          currentRoleId: currentRole.id,
          proposedRoleId: proposedRole.id,
          reason: "Test",
          submittedById: adminUserId,
          status: "APPROVED",
        },
      });

      const res = await DECISION(
        mockRequest(`/api/promotions/${promo.id}/decision`, {
          method: "POST",
          body: { status: "APPROVED" },
        }),
        { params: Promise.resolve({ id: promo.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("prevents self-approval", async () => {
      const { subjectMember, currentRole, proposedRole } = await createTestData();

      mockAuth(subjectMember.userId, ["promotion.approve"]);

      const promo = await prisma.promotionRequest.create({
        data: {
          memberId: subjectMember.id,
          currentRoleId: currentRole.id,
          proposedRoleId: proposedRole.id,
          reason: "Self approve test",
          submittedById: adminUserId,
          status: "SUBMITTED",
        },
      });

      const res = await DECISION(
        mockRequest(`/api/promotions/${promo.id}/decision`, {
          method: "POST",
          body: { status: "APPROVED" },
        }),
        { params: Promise.resolve({ id: promo.id }) }
      );
      expect(res.status).toBe(403);
    });

    it("returns 404 for nonexistent promotion", async () => {
      const res = await DECISION(
        mockRequest("/api/promotions/fake/decision", {
          method: "POST",
          body: { status: "APPROVED" },
        }),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/promotions/[id]", () => {
    it("returns a single promotion", async () => {
      const { subjectMember, currentRole, proposedRole } = await createTestData();

      const promo = await prisma.promotionRequest.create({
        data: {
          memberId: subjectMember.id,
          currentRoleId: currentRole.id,
          proposedRoleId: proposedRole.id,
          reason: "Test",
          submittedById: adminUserId,
          status: "SUBMITTED",
        },
      });

      const res = await GET_ONE(
        mockRequest(`/api/promotions/${promo.id}`),
        { params: Promise.resolve({ id: promo.id }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe(promo.id);
    });

    it("returns 404 for nonexistent promotion", async () => {
      const res = await GET_ONE(
        mockRequest("/api/promotions/fake"),
        { params: Promise.resolve({ id: "fake" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      clearAuth();
      const { subjectMember, currentRole, proposedRole } = await createTestData();
      const promo = await prisma.promotionRequest.create({
        data: { memberId: subjectMember.id, currentRoleId: currentRole.id, proposedRoleId: proposedRole.id, reason: "Test", submittedById: adminUserId, status: "SUBMITTED" },
      });
      const res = await GET_ONE(
        mockRequest(`/api/promotions/${promo.id}`),
        { params: Promise.resolve({ id: promo.id }) }
      );
      expect(res.status).toBe(401);
    });
  });
});
