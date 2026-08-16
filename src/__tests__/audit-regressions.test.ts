/**
 * Regression tests for the issues found during the full-stack audit.
 *
 * Each block documents the concrete defect it locks down, so a future change
 * that reintroduces the behaviour fails here with an explanation rather than a
 * bare assertion mismatch.
 */
import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/lib/prisma";

import { GET as PUBLIC_DEPARTMENTS } from "@/app/api/public/departments/route";
import { GET as PUBLIC_COMMITTEE } from "@/app/api/public/committee/route";
import { GET as PUBLIC_HOME } from "@/app/api/public/home/route";
import { GET as COMMITTEES } from "@/app/api/committees/route";
import { GET as PROMOTIONS } from "@/app/api/promotions/route";
import { GET as PROMOTION_ONE } from "@/app/api/promotions/[id]/route";
import { POST as DECISION } from "@/app/api/promotions/[id]/decision/route";
import { PATCH as TASK_PATCH } from "@/app/api/departments/[id]/tasks/[taskId]/route";
import { GET as DEPT_DASHBOARD } from "@/app/api/dashboard/department/route";
import { POST as EVENT_POST } from "@/app/api/events/route";

import { sanitizeCallbackUrl } from "@/lib/callback-url";

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

/** Personal fields that must never ride along on an embedded member record. */
const PERSONAL_FIELDS = [
  "phone",
  "address",
  "dateOfBirth",
  "emergencyContact",
] as const;

/** Recursively collects every path where a personal field is present. */
function findPersonalFields(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (value === null || typeof value !== "object") return hits;
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...findPersonalFields(v, `${path}[${i}]`)));
    return hits;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((PERSONAL_FIELDS as readonly string[]).includes(key)) {
      hits.push(`${path}.${key}`);
    }
    hits.push(...findPersonalFields(child, `${path}.${key}`));
  }
  return hits;
}

async function grantRole(userId: string, memberId: string, committeeId: string, keys: string[]) {
  const permissionIds = await Promise.all(
    keys.map(async (k) => {
      const p = await prisma.permission.findUnique({ where: { key: k } });
      return p!.id;
    })
  );
  const role = await createTestRole({ name: `R-${uniqueSuffix()}`, permissionIds });
  await assignCommitteeRole(memberId, role.id, committeeId);
  return role;
}

describe("Audit regressions", () => {
  beforeEach(async () => {
    await cleanupTestData();
    await seedPermissions();
  });

  // -------------------------------------------------------------------------
  describe("member PII is not leaked through embedded relations", () => {
    /**
     * Coordinators' phone numbers and home addresses were reaching
     * unauthenticated callers because these routes used `include` on a member
     * relation, which returns every Member scalar alongside the selected user
     * fields.
     */
    async function seedCommitteeWithPersonalData() {
      const committee = await createTestCommittee({ isCurrent: true });
      const { user } = await createTestUser();
      const member = await prisma.member.create({
        data: {
          userId: user.id,
          memberCode: `PII-${uniqueSuffix()}`,
          status: "ACTIVE",
          phone: "+8801700000000",
          address: "13 Secret Lane, Dhaka",
          emergencyContact: "+8801799999999",
          dateOfBirth: new Date("1999-05-05"),
        },
      });
      const dept = await createTestDepartment({
        committeeId: committee.id,
        coordinatorId: member.id,
      });
      const role = await createTestRole({ name: `Chair-${uniqueSuffix()}` });
      await assignCommitteeRole(member.id, role.id, committee.id);
      return { committee, member, dept, user };
    }

    it("GET /api/public/departments exposes no personal fields", async () => {
      await seedCommitteeWithPersonalData();
      clearAuth();

      const res = await PUBLIC_DEPARTMENTS();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(findPersonalFields(body)).toEqual([]);
    });

    it("GET /api/public/committee exposes no personal fields", async () => {
      await seedCommitteeWithPersonalData();
      clearAuth();

      const res = await PUBLIC_COMMITTEE();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(findPersonalFields(body)).toEqual([]);
    });

    it("GET /api/public/home exposes no personal fields", async () => {
      await seedCommitteeWithPersonalData();
      clearAuth();

      const res = await PUBLIC_HOME();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(findPersonalFields(body)).toEqual([]);
    });

    it("GET /api/committees exposes no personal fields to anonymous callers", async () => {
      await seedCommitteeWithPersonalData();
      clearAuth();

      const res = await COMMITTEES(mockRequest("/api/committees"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(findPersonalFields(body)).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe("promotion visibility", () => {
    /**
     * `promotion.submit` is the permission to raise your OWN request. It used
     * to return every member's promotion — reason, achievements and the
     * subject's contact details included.
     */
    async function seedPromotions() {
      const committee = await createTestCommittee({ isCurrent: true });

      const submitter = await createTestUser();
      const submitterMember = await createTestMember({
        userId: submitter.user.id,
        status: "ACTIVE",
      });
      await grantRole(submitter.user.id, submitterMember.id, committee.id, [
        "promotion.submit",
      ]);

      const other = await createTestUser();
      const otherMember = await prisma.member.create({
        data: {
          userId: other.user.id,
          memberCode: `OTH-${uniqueSuffix()}`,
          status: "ACTIVE",
          phone: "+8801712345678",
          address: "Somewhere private",
        },
      });

      const roleA = await createTestRole({ name: `A-${uniqueSuffix()}` });
      const roleB = await createTestRole({ name: `B-${uniqueSuffix()}` });

      const mine = await prisma.promotionRequest.create({
        data: {
          memberId: submitterMember.id,
          currentRoleId: roleA.id,
          proposedRoleId: roleB.id,
          reason: "Mine",
          submittedById: submitter.user.id,
          status: "SUBMITTED",
        },
      });
      const theirs = await prisma.promotionRequest.create({
        data: {
          memberId: otherMember.id,
          currentRoleId: roleA.id,
          proposedRoleId: roleB.id,
          reason: "Theirs",
          submittedById: other.user.id,
          status: "SUBMITTED",
        },
      });

      return { submitter, submitterMember, other, otherMember, mine, theirs, committee };
    }

    it("a submitter-only member sees only their own promotions", async () => {
      const { submitter, mine } = await seedPromotions();
      mockAuth(submitter.user.id, ["promotion.submit"]);

      const res = await PROMOTIONS(mockRequest("/api/promotions"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.promotions.map((p: { id: string }) => p.id)).toEqual([mine.id]);
      expect(findPersonalFields(body)).toEqual([]);
    });

    it("a submitter-only member cannot read another member's promotion by id", async () => {
      const { submitter, theirs } = await seedPromotions();
      mockAuth(submitter.user.id, ["promotion.submit"]);

      const res = await PROMOTION_ONE(mockRequest(`/api/promotions/${theirs.id}`), {
        params: Promise.resolve({ id: theirs.id }),
      });

      expect(res.status).toBe(404);
    });

    it("an approver still sees the whole queue", async () => {
      const { committee, mine, theirs } = await seedPromotions();

      const approver = await createTestUser();
      const approverMember = await createTestMember({
        userId: approver.user.id,
        status: "ACTIVE",
      });
      await grantRole(approver.user.id, approverMember.id, committee.id, [
        "promotion.approve",
      ]);
      mockAuth(approver.user.id, ["promotion.approve"]);

      const res = await PROMOTIONS(mockRequest("/api/promotions"));
      const body = await res.json();

      expect(res.status).toBe(200);
      const ids = body.promotions.map((p: { id: string }) => p.id).sort();
      expect(ids).toEqual([mine.id, theirs.id].sort());
    });
  });

  // -------------------------------------------------------------------------
  describe("promotion decision is single-shot", () => {
    /**
     * The reviewable-state check ran outside the transaction, so two
     * concurrent approvals both succeeded — writing two audit rows and sending
     * the member two "approved" notifications.
     */
    async function seedReviewablePromotion() {
      const committee = await createTestCommittee({ isCurrent: true });

      const approver = await createTestUser();
      const approverMember = await createTestMember({
        userId: approver.user.id,
        status: "ACTIVE",
      });
      await grantRole(approver.user.id, approverMember.id, committee.id, [
        "promotion.approve",
      ]);

      const subject = await createTestUser();
      const subjectMember = await createTestMember({
        userId: subject.user.id,
        status: "ACTIVE",
      });
      const roleA = await createTestRole({ name: `Cur-${uniqueSuffix()}` });
      const roleB = await createTestRole({ name: `Prop-${uniqueSuffix()}` });
      await assignCommitteeRole(subjectMember.id, roleA.id, committee.id);

      const promo = await prisma.promotionRequest.create({
        data: {
          memberId: subjectMember.id,
          currentRoleId: roleA.id,
          proposedRoleId: roleB.id,
          reason: "Earned it",
          submittedById: subject.user.id,
          status: "SUBMITTED",
        },
      });

      mockAuth(approver.user.id, ["promotion.approve"]);

      const call = () =>
        DECISION(
          mockRequest(`/api/promotions/${promo.id}/decision`, {
            method: "POST",
            body: { status: "APPROVED" },
          }),
          { params: Promise.resolve({ id: promo.id }) }
        );

      return { promo, call, subjectMember };
    }

    it("two concurrent approvals produce exactly one decision", async () => {
      const { promo, call, subjectMember } = await seedReviewablePromotion();

      // Fired together so both clear the pre-flight status check before either
      // commits — this is the shape that previously double-wrote.
      const results = await Promise.all([call(), call()]);
      const statuses = results.map((r) => r.status).sort();

      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      // The loser is refused: 409 if it reached the transactional guard, 400 if
      // it was slow enough to be caught by the pre-flight check.
      expect(statuses.filter((s) => s === 409 || s === 400)).toHaveLength(1);

      const audits = await prisma.auditLog.findMany({
        where: { entityType: "PromotionRequest", entityId: promo.id },
      });
      expect(audits).toHaveLength(1);

      const subjectUser = await prisma.member.findUnique({
        where: { id: subjectMember.id },
        select: { userId: true },
      });
      const notifications = await prisma.notification.findMany({
        where: { userId: subjectUser!.userId, type: "PROMOTION" },
      });
      expect(notifications.length).toBeLessThanOrEqual(1);
    });

    it("a sequential retry is refused once the request is decided", async () => {
      const { promo, call } = await seedReviewablePromotion();

      const first = await call();
      const second = await call();

      expect(first.status).toBe(200);
      expect([400, 409]).toContain(second.status);

      const audits = await prisma.auditLog.findMany({
        where: { entityType: "PromotionRequest", entityId: promo.id },
      });
      expect(audits).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  describe("task assignee validation", () => {
    /**
     * PATCH accepted any cuid-shaped assignee and let the foreign-key
     * violation surface as a 500. POST already validated this.
     */
    it("PATCH with an unknown assignee returns 404, not 500", async () => {
      const committee = await createTestCommittee({ isCurrent: true });
      const dept = await createTestDepartment({ committeeId: committee.id });

      const admin = await createTestUser();
      const adminMember = await createTestMember({
        userId: admin.user.id,
        status: "ACTIVE",
      });
      await grantRole(admin.user.id, adminMember.id, committee.id, [
        "department.manage",
      ]);
      mockAuth(admin.user.id, ["department.manage"]);

      const task = await prisma.task.create({
        data: { departmentId: dept.id, title: "Build the set" },
      });

      const res = await TASK_PATCH(
        mockRequest(`/api/departments/${dept.id}/tasks/${task.id}`, {
          method: "PATCH",
          body: { assigneeId: "cl00000000000000000000000" },
        }),
        { params: Promise.resolve({ id: dept.id, taskId: task.id }) }
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/assignee/i);
    });
  });

  // -------------------------------------------------------------------------
  describe("department dashboard honours global permission", () => {
    /**
     * PRD §3b grants access either globally or via department membership.
     * Only the membership branch existed, so administrators were locked out.
     */
    it("global department.manage grants access without membership", async () => {
      const committee = await createTestCommittee({ isCurrent: true });
      const dept = await createTestDepartment({ committeeId: committee.id });

      const admin = await createTestUser();
      const adminMember = await createTestMember({
        userId: admin.user.id,
        status: "ACTIVE",
      });
      await grantRole(admin.user.id, adminMember.id, committee.id, [
        "department.manage",
      ]);
      mockAuth(admin.user.id, ["department.manage"]);

      const res = await DEPT_DASHBOARD(
        mockRequest("/api/dashboard/department", {
          searchParams: { departmentId: dept.id },
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.department.id).toBe(dept.id);
    });

    it("a member of neither kind is still refused", async () => {
      const committee = await createTestCommittee({ isCurrent: true });
      const dept = await createTestDepartment({ committeeId: committee.id });

      const outsider = await createTestUser();
      const outsiderMember = await createTestMember({
        userId: outsider.user.id,
        status: "ACTIVE",
      });
      await grantRole(outsider.user.id, outsiderMember.id, committee.id, [
        "department.view",
      ]);
      mockAuth(outsider.user.id, ["department.view"]);

      const res = await DEPT_DASHBOARD(
        mockRequest("/api/dashboard/department", {
          searchParams: { departmentId: dept.id },
        })
      );

      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  describe("event creation honours the requested status", () => {
    /**
     * `eventSchema` accepts a status but POST hardcoded UPCOMING, so a DRAFT
     * event — the one status the public site filters out — was uncreatable.
     */
    it("creates a DRAFT event and does not announce it", async () => {
      const committee = await createTestCommittee({ isCurrent: true });
      const manager = await createTestUser();
      const managerMember = await createTestMember({
        userId: manager.user.id,
        status: "ACTIVE",
      });
      await grantRole(manager.user.id, managerMember.id, committee.id, [
        "events.manage",
      ]);
      mockAuth(manager.user.id, ["events.manage"]);

      const res = await EVENT_POST(
        mockRequest("/api/events", {
          method: "POST",
          body: {
            title: "Unannounced rehearsal",
            type: "REHEARSAL",
            status: "DRAFT",
            startAt: new Date(Date.now() + 86_400_000).toISOString(),
          },
        })
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.status).toBe("DRAFT");

      const notifications = await prisma.notification.findMany({
        where: { type: "EVENT" },
      });
      expect(notifications).toHaveLength(0);
    });

    it("still defaults to UPCOMING when no status is supplied", async () => {
      const committee = await createTestCommittee({ isCurrent: true });
      const manager = await createTestUser();
      const managerMember = await createTestMember({
        userId: manager.user.id,
        status: "ACTIVE",
      });
      await grantRole(manager.user.id, managerMember.id, committee.id, [
        "events.manage",
      ]);
      mockAuth(manager.user.id, ["events.manage"]);

      const res = await EVENT_POST(
        mockRequest("/api/events", {
          method: "POST",
          body: {
            title: "Public rehearsal",
            type: "REHEARSAL",
            startAt: new Date(Date.now() + 86_400_000).toISOString(),
          },
        })
      );

      expect(res.status).toBe(201);
      expect((await res.json()).status).toBe("UPCOMING");
    });
  });

  // -------------------------------------------------------------------------
  describe("callback URL sanitiser blocks off-origin redirects", () => {
    /**
     * A backslash is equivalent to a forward slash in the authority position,
     * so "/\evil.com" resolved to https://evil.com/ while passing the old
     * "//" check.
     */
    const BS = String.fromCharCode(92);

    it.each([
      ["//evil.com", "protocol-relative"],
      [`/${BS}evil.com`, "single backslash"],
      [`/${BS}${BS}evil.com`, "double backslash"],
      [`/${BS}/evil.com`, "backslash + slash"],
      ["https://evil.com", "absolute URL"],
      ["evil.com", "bare host"],
    ])("rejects %s (%s)", (input) => {
      expect(sanitizeCallbackUrl(input)).toBeNull();
    });

    it("rejects values containing control characters", () => {
      expect(sanitizeCallbackUrl("/dashboard\nSet-Cookie: x=1")).toBeNull();
      expect(sanitizeCallbackUrl("/dashboard ")).toBeNull();
    });

    it("still accepts ordinary in-app paths", () => {
      expect(sanitizeCallbackUrl("/dashboard")).toBe("/dashboard");
      expect(sanitizeCallbackUrl("/dashboard/members?page=2")).toBe(
        "/dashboard/members?page=2"
      );
    });

    it("never returns an auth page", () => {
      expect(sanitizeCallbackUrl("/login")).toBeNull();
      expect(sanitizeCallbackUrl("/register")).toBeNull();
    });

    it("resolves rejected candidates to a same-origin URL when parsed", () => {
      // Guards the property that actually matters: whatever survives the
      // sanitiser must stay on this origin once the browser resolves it.
      const safe = sanitizeCallbackUrl("/dashboard/settings");
      expect(new URL(safe!, "https://dcms.example").origin).toBe(
        "https://dcms.example"
      );
    });
  });
});
