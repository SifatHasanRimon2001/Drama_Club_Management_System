import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { PATCH as APPLICANT_PATCH } from "@/app/api/applicants/[id]/route";
import { POST as APPLICANT_CONVERT } from "@/app/api/applicants/[id]/convert/route";
import { POST as COMMITTEES_POST } from "@/app/api/committees/route";
import { PATCH as COMMITTEE_PATCH } from "@/app/api/committees/[id]/route";
import { POST as COMMITTEE_ROLES_POST } from "@/app/api/committees/[id]/roles/route";
import { PATCH as DEPARTMENT_PATCH } from "@/app/api/departments/[id]/route";
import { POST as DEPT_TASKS_POST } from "@/app/api/departments/[id]/tasks/route";
import { PATCH as TASK_PATCH } from "@/app/api/departments/[id]/tasks/[taskId]/route";
import { PATCH as EVENT_PATCH } from "@/app/api/events/[id]/route";
import { POST as GALLERY_POST } from "@/app/api/gallery/route";
import { POST as GALLERY_ITEMS_POST } from "@/app/api/gallery/items/route";
import { POST as GALLERY_UPLOAD_POST } from "@/app/api/gallery/upload-url/route";
import { PATCH as MEMBER_PATCH } from "@/app/api/members/[id]/route";
import { POST as MEMBER_DEPTS_POST } from "@/app/api/members/[id]/departments/route";
import { POST as PROMOTIONS_POST } from "@/app/api/promotions/route";
import { POST as PROMO_DECISION_POST } from "@/app/api/promotions/[id]/decision/route";
import { POST as RW_POST } from "@/app/api/registration-windows/route";
import { PATCH as RW_PATCH } from "@/app/api/registration-windows/[id]/route";
import { PATCH as APPLICANT_REVIEW_PATCH } from "@/app/api/registration-windows/[id]/applicants/[applicantId]/route";
import { POST as ROLES_POST } from "@/app/api/roles/route";
import { PATCH as ROLE_PATCH } from "@/app/api/roles/[id]/route";
import { PATCH as SETTINGS_PATCH } from "@/app/api/settings/route";
import { POST as UPDATES_POST } from "@/app/api/updates/route";
import { PATCH as UPDATE_PATCH } from "@/app/api/updates/[id]/route";
import {
  mockAuth,
  clearAuth,
  cleanupTestData,
  createTestUser,
  createTestMember,
  createTestRole,
  createTestCommittee,
  assignCommitteeRole,
  seedPermissions,
  uniqueSuffix,
} from "./helpers";

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

function badJsonRequest(url: string, method: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    body: "{not-valid-json",
    headers: { "content-type": "application/json" },
  });
}

async function setupAuthedUser(permission: string) {
  const user = await createTestUser();
  const member = await createTestMember({ userId: user.user.id, status: "ACTIVE" });
  const cmt = await createTestCommittee({ isCurrent: true });
  const perm = await prisma.permission.findUniqueOrThrow({ where: { key: permission } });
  const role = await createTestRole({ name: `MJ-${uniqueSuffix()}`, permissionIds: [perm.id] });
  await assignCommitteeRole(member.id, role.id, cmt.id);
  mockAuth(user.user.id, [permission]);
}

const CASES: { name: string; handler: Handler; perm: string; method: string; params: Record<string, string> }[] = [
  { name: "applicants/[id] PATCH", handler: APPLICANT_PATCH as unknown as Handler, perm: "registration.review", method: "PATCH", params: { id: "x" } },
  { name: "applicants/[id]/convert POST", handler: APPLICANT_CONVERT as unknown as Handler, perm: "member.create", method: "POST", params: { id: "x" } },
  { name: "committees POST", handler: COMMITTEES_POST as unknown as Handler, perm: "committee.manage", method: "POST", params: {} },
  { name: "committees/[id] PATCH", handler: COMMITTEE_PATCH as unknown as Handler, perm: "committee.manage", method: "PATCH", params: { id: "x" } },
  { name: "committees/[id]/roles POST", handler: COMMITTEE_ROLES_POST as unknown as Handler, perm: "committee.manage", method: "POST", params: { id: "x" } },
  { name: "departments/[id] PATCH", handler: DEPARTMENT_PATCH as unknown as Handler, perm: "department.manage", method: "PATCH", params: { id: "x" } },
  { name: "departments/[id]/tasks POST", handler: DEPT_TASKS_POST as unknown as Handler, perm: "department.manage", method: "POST", params: { id: "x" } },
  { name: "departments/[id]/tasks/[taskId] PATCH", handler: TASK_PATCH as unknown as Handler, perm: "department.manage", method: "PATCH", params: { id: "x", taskId: "y" } },
  { name: "events/[id] PATCH", handler: EVENT_PATCH as unknown as Handler, perm: "events.manage", method: "PATCH", params: { id: "x" } },
  { name: "gallery POST", handler: GALLERY_POST as unknown as Handler, perm: "gallery.manage", method: "POST", params: {} },
  { name: "gallery/items POST", handler: GALLERY_ITEMS_POST as unknown as Handler, perm: "gallery.upload", method: "POST", params: {} },
  { name: "gallery/upload-url POST", handler: GALLERY_UPLOAD_POST as unknown as Handler, perm: "gallery.upload", method: "POST", params: {} },
  { name: "members/[id] PATCH", handler: MEMBER_PATCH as unknown as Handler, perm: "member.edit", method: "PATCH", params: { id: "x" } },
  { name: "members/[id]/departments POST", handler: MEMBER_DEPTS_POST as unknown as Handler, perm: "department.manage", method: "POST", params: { id: "x" } },
  { name: "promotions POST", handler: PROMOTIONS_POST as unknown as Handler, perm: "promotion.submit", method: "POST", params: {} },
  { name: "promotions/[id]/decision POST", handler: PROMO_DECISION_POST as unknown as Handler, perm: "promotion.approve", method: "POST", params: { id: "x" } },
  { name: "registration-windows POST", handler: RW_POST as unknown as Handler, perm: "registration.manage", method: "POST", params: {} },
  { name: "registration-windows/[id] PATCH", handler: RW_PATCH as unknown as Handler, perm: "registration.manage", method: "PATCH", params: { id: "x" } },
  { name: "registration-windows/[id]/applicants/[applicantId] PATCH", handler: APPLICANT_REVIEW_PATCH as unknown as Handler, perm: "registration.review", method: "PATCH", params: { id: "x", applicantId: "y" } },
  { name: "roles POST", handler: ROLES_POST as unknown as Handler, perm: "permissions.manage", method: "POST", params: {} },
  { name: "roles/[id] PATCH", handler: ROLE_PATCH as unknown as Handler, perm: "permissions.manage", method: "PATCH", params: { id: "x" } },
  { name: "settings PATCH", handler: SETTINGS_PATCH as unknown as Handler, perm: "settings.manage", method: "PATCH", params: {} },
  { name: "updates POST", handler: UPDATES_POST as unknown as Handler, perm: "updates.publish", method: "POST", params: {} },
  { name: "updates/[id] PATCH", handler: UPDATE_PATCH as unknown as Handler, perm: "updates.publish", method: "PATCH", params: { id: "x" } },
];

describe("malformed JSON body on every mutating route", () => {
  beforeEach(async () => {
    await seedPermissions();
  });

  afterEach(async () => {
    clearAuth();
    await cleanupTestData();
  });

  for (const c of CASES) {
    it(`${c.name} returns 400 with Invalid JSON body`, async () => {
      await setupAuthedUser(c.perm);
      const res = await c.handler(badJsonRequest(`/api/${c.name.split(" ")[0]}`, c.method), {
        params: Promise.resolve(c.params),
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid JSON body" });
    });
  }
});
