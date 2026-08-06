import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { POST as CONTACT_POST } from "@/app/api/contact/route";
import { POST as REGISTER_POST } from "@/app/api/auth/register/route";
import { POST as MEMBERS_POST } from "@/app/api/members/route";
import { POST as EVENTS_POST } from "@/app/api/events/route";
import { POST as DEPARTMENTS_POST } from "@/app/api/departments/route";
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

function badJsonRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    body: "{not-valid-json",
    headers: { "content-type": "application/json", ...headers },
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

describe("malformed JSON body handling", () => {
  beforeEach(async () => {
    await seedPermissions();
  });

  afterEach(async () => {
    clearAuth();
    await cleanupTestData();
  });

  it("contact POST returns 400 with Invalid JSON body", async () => {
    const res = await CONTACT_POST(
      badJsonRequest("/api/contact", { "x-forwarded-for": `5.1.${Date.now() % 250}.7` })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("auth register POST returns 400 with Invalid JSON body", async () => {
    const res = await REGISTER_POST(badJsonRequest("/api/auth/register"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("members POST returns 400 with Invalid JSON body", async () => {
    await setupAuthedUser("member.create");
    const res = await MEMBERS_POST(badJsonRequest("/api/members"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("events POST returns 400 with Invalid JSON body", async () => {
    await setupAuthedUser("events.manage");
    const res = await EVENTS_POST(badJsonRequest("/api/events"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("departments POST returns 400 with Invalid JSON body", async () => {
    await setupAuthedUser("department.manage");
    const res = await DEPARTMENTS_POST(badJsonRequest("/api/departments"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });
});
