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
 * phone, address, date of birth and emergency contact — see
 * PERSONAL_MEMBER_FIELDS below for why those are gated separately.
 */
export const INTERNAL_MEMBER_SELECT = {
  id: true,
  memberCode: true,
  status: true,
  user: { select: { id: true, name: true, email: true, image: true } },
} as const;

/**
 * The member directory row — everything needed to find and identify a person,
 * and nothing that could be used to turn up at their front door.
 */
export const DIRECTORY_MEMBER_SELECT = {
  id: true,
  userId: true,
  memberCode: true,
  status: true,
  joiningDate: true,
  photoUrl: true,
  user: { select: { id: true, name: true, email: true, image: true } },
} as const;

/**
 * Home address, phone, date of birth and emergency contact.
 *
 * These are deliberately NOT part of `member.view`. Every seeded role — down to
 * the base "Member" — holds `member.view`, because it is what powers the member
 * directory. Returning personal contact details under that permission meant any
 * ordinary member could read all 87 members' home addresses simply by walking
 * ids through `/api/members/:id`.
 *
 * Spread these in only when the viewer is the member themselves, or holds
 * `member.edit` (the permission that actually administers profiles).
 */
export const PERSONAL_MEMBER_FIELDS = {
  phone: true,
  dateOfBirth: true,
  address: true,
  emergencyContact: true,
} as const;
