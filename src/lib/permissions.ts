import prisma from "@/lib/prisma";

export const PERMISSIONS = [
  "member.view",
  "member.create",
  "member.edit",
  "department.view",
  "department.manage",
  "committee.manage",
  "registration.manage",
  "registration.review",
  "promotion.submit",
  "promotion.approve",
  "gallery.upload",
  "gallery.manage",
  "updates.publish",
  "events.manage",
  "permissions.manage",
  "settings.manage",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

/**
 * Check if a user has a specific permission.
 *
 * Department-scoped access (PRD 3b):
 * - Without scope: user must have the permission via any current role
 * - With scope: user must have the permission AND be a member/coordinator of that department
 */
export async function can(
  userId: string,
  permissionKey: string,
  scope?: { departmentId?: string }
): Promise<boolean> {
  if (!userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberProfile: {
        include: {
          committeeRoles: {
            where: { endedAt: null },
            include: {
              role: {
                include: {
                  permissions: {
                    include: { permission: true },
                  },
                },
              },
              committee: true,
            },
          },
          departments: true,
          coordinatedDepts: true,
        },
      },
    },
  });

  if (!user?.memberProfile) return false;

  const member = user.memberProfile;

  // Suspended/inactive members hold no API permissions even while a stale
  // JWT session remains valid (login blocks them, but tokens live up to 24h).
  if (member.status === "SUSPENDED" || member.status === "INACTIVE") {
    return false;
  }

  // Get current committee roles
  const currentRoles = member.committeeRoles.filter(
    (cr) => cr.committee?.isCurrent
  );

  // Check if any current role grants the permission
  const hasPermission = currentRoles.some((cr) =>
    cr.role.permissions.some((rp) => rp.permission.key === permissionKey)
  );

  if (!hasPermission) return false;

  // If no scope required, the user has the permission globally
  if (!scope?.departmentId) return true;

  // With scope: user must be a member or coordinator of the department
  const isMember = member.departments.some(
    (d) => d.departmentId === scope.departmentId
  );
  const isCoordinator = member.coordinatedDepts.some(
    (d) => d.id === scope.departmentId
  );

  return isMember || isCoordinator;
}

/**
 * Get all permission keys for a user (for session/client-side checks).
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  if (!userId) return [];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberProfile: {
        include: {
          committeeRoles: {
            where: { endedAt: null },
            include: {
              role: {
                include: {
                  permissions: {
                    include: { permission: true },
                  },
                },
              },
              committee: true,
            },
          },
        },
      },
    },
  });

  if (!user?.memberProfile) return [];

  // Stale-JWT guard: suspended/inactive members keep no permissions.
  if (
    user.memberProfile.status === "SUSPENDED" ||
    user.memberProfile.status === "INACTIVE"
  ) {
    return [];
  }

  const currentRoles = user.memberProfile.committeeRoles.filter(
    (cr) => cr.committee.isCurrent
  );

  const permSet = new Set<string>();
  for (const cr of currentRoles) {
    for (const rp of cr.role.permissions) {
      permSet.add(rp.permission.key);
    }
  }

  return Array.from(permSet);
}

/**
 * Check if a user has ANY of the given permissions (global check, no scope).
 * Fetches the user once and checks all keys against the result.
 */
export async function canAny(
  userId: string,
  permissionKeys: string[]
): Promise<boolean> {
  if (!userId || permissionKeys.length === 0) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberProfile: {
        include: {
          committeeRoles: {
            where: { endedAt: null, committee: { isCurrent: true } },
            include: {
              role: {
                include: {
                  permissions: {
                    include: { permission: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user?.memberProfile) return false;

  // Stale-JWT guard: suspended/inactive members hold no permissions.
  if (
    user.memberProfile.status === "SUSPENDED" ||
    user.memberProfile.status === "INACTIVE"
  ) {
    return false;
  }

  const permSet = new Set<string>();
  for (const cr of user.memberProfile.committeeRoles) {
    for (const rp of cr.role.permissions) {
      permSet.add(rp.permission.key);
    }
  }

  return permissionKeys.some((key) => permSet.has(key));
}

/**
 * Require a permission or throw. Returns the user's id for chaining.
 */
export async function requirePermission(
  userId: string,
  permissionKey: string,
  scope?: { departmentId?: string }
): Promise<void> {
  const allowed = await can(userId, permissionKey, scope);
  if (!allowed) {
    throw new Error(`Permission denied: ${permissionKey}`);
  }
}
