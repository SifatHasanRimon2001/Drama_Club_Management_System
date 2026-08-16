/**
 * Shared Prisma `select` shapes for the `Member` model.
 *
 * A `Member` row carries personal data — `phone`, `address`, `dateOfBirth`,
 * `emergencyContact` — that must never reach a response body just because a
 * route needed the member's name. Using `include: { user: ... }` on a member
 * relation silently returns *every* Member scalar alongside the selected user
 * fields, which is exactly how coordinator phone numbers and home addresses
 * ended up in unauthenticated `/api/public/*` responses.
 *
 * These constants are the single source of truth for "how much of a member may
 * this audience see". Prefer them over an ad-hoc `include` whenever a member is
 * embedded in another entity's response.
 */

/**
 * Anonymous/public audience: identity only, nothing personal.
 * Used by every `/api/public/*` route.
 */
export const PUBLIC_MEMBER_SELECT = {
  id: true,
  user: { select: { id: true, name: true, image: true } },
} as const;

/**
 * Signed-in directory audience: adds the club-internal member code and the
 * work email so staff can identify and contact each other. Still excludes
 * phone, address, date of birth and emergency contact — those belong to the
 * member's own profile view (`/api/members/:id`, gated by `member.view`).
 */
export const INTERNAL_MEMBER_SELECT = {
  id: true,
  memberCode: true,
  status: true,
  user: { select: { id: true, name: true, email: true, image: true } },
} as const;
