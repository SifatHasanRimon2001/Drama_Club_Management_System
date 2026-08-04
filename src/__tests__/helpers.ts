import { NextRequest } from "next/server";
import { vi } from "vitest";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

let testCounter = 0;

export function uniqueSuffix(): string {
  testCounter++;
  return `${Date.now()}-${testCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function mockRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  }
): NextRequest {
  const fullUrl = new URL(url, "http://localhost:3000");
  if (options?.searchParams) {
    for (const [k, v] of Object.entries(options.searchParams)) {
      fullUrl.searchParams.set(k, v);
    }
  }

  return new NextRequest(fullUrl.toString(), {
    method: options?.method || "GET",
    body: options?.body ? JSON.stringify(options.body) : undefined,
    headers: {
      "content-type": "application/json",
      ...options?.headers,
    },
  });
}

// Use vi.mocked on the imported auth (which is already mocked by setup.ts)
import { auth } from "@/lib/auth";

export function mockAuth(userId: string, permissions: string[] = [], overrides?: { email?: string; name?: string; image?: string | null }) {
  vi.mocked(auth).mockResolvedValue({
    user: {
      id: userId,
      email: overrides?.email ?? "test@test.com",
      name: overrides?.name ?? "Test User",
      image: overrides?.image,
      permissions,
    },
  } as never);
}

// Valid CUID format for tests that need invalid-looking but schema-valid IDs
export const NON_EXISTENT_CUID = "cl00000000000000000000000";

export function clearAuth() {
  vi.mocked(auth).mockResolvedValue(null as never);
}

export async function createTestUser(data?: {
  name?: string;
  email?: string;
  password?: string;
}) {
  const suffix = uniqueSuffix();
  const name = data?.name || `Test User ${suffix}`;
  const email = data?.email || `test-${suffix}@test.com`;
  const password = data?.password || "password123";
  const passwordHash = await bcrypt.hash(password, 4);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
  });

  return { user, password };
}

export async function createTestMember(data?: {
  userId?: string;
  memberCode?: string;
  status?: "PENDING" | "ACTIVE" | "ALUMNI" | "INACTIVE" | "SUSPENDED";
}) {
  const suffix = uniqueSuffix();
  return prisma.member.create({
    data: {
      userId: data?.userId || (await createTestUser()).user.id,
      memberCode: data?.memberCode || `M${suffix}`,
      status: data?.status || "ACTIVE",
    },
  });
}

export async function createTestCommittee(data?: {
  year?: string;
  isCurrent?: boolean;
  status?: "ACTIVE" | "DISSOLVED" | "UPCOMING";
}) {
  const suffix = uniqueSuffix();
  return prisma.committee.create({
    data: {
      year: data?.year || `202${suffix.slice(-1)}`,
      startDate: new Date("2024-01-01"),
      isCurrent: data?.isCurrent ?? true,
      status: data?.status || "ACTIVE",
    },
  });
}

export async function createTestDepartment(data?: {
  committeeId?: string;
  name?: string;
  coordinatorId?: string;
}) {
  const suffix = uniqueSuffix();
  const committeeId = data?.committeeId || (await createTestCommittee()).id;
  return prisma.department.create({
    data: {
      name: data?.name || `Dept ${suffix}`,
      committeeId,
      coordinatorId: data?.coordinatorId,
    },
  });
}

export async function createTestRole(data?: {
  name?: string;
  permissionIds?: string[];
}) {
  const suffix = uniqueSuffix();
  return prisma.role.create({
    data: {
      name: data?.name ? `${data.name}-${suffix}` : `Role-${suffix}`,
      permissions: data?.permissionIds?.length
        ? {
            create: data.permissionIds.map((permissionId) => ({
              permissionId,
            })),
          }
        : undefined,
    },
    include: { permissions: true },
  });
}

export async function getTestPermission(key: string) {
  return prisma.permission.findUnique({ where: { key } });
}

export async function assignCommitteeRole(memberId: string, roleId: string, committeeId: string) {
  return prisma.committeeMemberRole.create({
    data: {
      memberId,
      roleId,
      committeeId,
    },
  });
}

export async function assignDepartment(memberId: string, departmentId: string) {
  return prisma.memberDepartment.create({
    data: {
      memberId,
      departmentId,
    },
  });
}

export async function cleanupTestData() {
  const tableNames = [
    "AuditLog",
    "GalleryItem",
    "GalleryAlbum",
    "Notification",
    "EventRsvp",
    "Event",
    "ClubUpdate",
    "Applicant",
    "RegistrationWindow",
    "ContactSubmission",
    "Task",
    "MemberDepartment",
    "CommitteeMemberRole",
    "PromotionRequest",
    "RolePermission",
    "Role",
    "Department",
    "Committee",
    "Member",
    "SystemSetting",
    "User",
  ];

  // Delete in reverse dependency order to avoid FK violations.
  // TRUNCATE TABLE ... CASCADE causes deadlocks with the PrismaPg adapter
  // because it requires ACCESS EXCLUSIVE locks on all tables simultaneously.
  for (const table of tableNames) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
}

// Seed the 16 core permissions (same as seed.ts) using createMany with skipDuplicates
export async function seedPermissions() {
  const permDefs = [
    ["member.view", "View member profiles"],
    ["member.create", "Create new members"],
    ["member.edit", "Edit member profiles"],
    ["department.view", "View departments"],
    ["department.manage", "Manage departments"],
    ["committee.manage", "Manage committees"],
    ["registration.manage", "Manage registration windows"],
    ["registration.review", "Review applicants"],
    ["promotion.submit", "Submit promotion requests"],
    ["promotion.approve", "Approve/reject promotions"],
    ["gallery.upload", "Upload to gallery"],
    ["gallery.manage", "Manage gallery albums"],
    ["updates.publish", "Publish club updates"],
    ["events.manage", "Manage events"],
    ["permissions.manage", "Manage roles & permissions"],
    ["settings.manage", "Manage system settings"],
  ] as const;

  await prisma.permission.createMany({
    data: permDefs.map(([key, description]) => ({ key, description })),
    skipDuplicates: true,
  });

  return prisma.permission.findMany();
}
