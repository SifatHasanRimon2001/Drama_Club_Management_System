/**
 * Registration window status state machine (PRD §4):
 *   DRAFT -> SCHEDULED -> LIVE -> CLOSED
 * CLOSED -> LIVE is allowed as an explicit "reopen" action.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SCHEDULED", "LIVE"],
  SCHEDULED: ["LIVE"],
  LIVE: ["CLOSED"],
  CLOSED: ["LIVE"],
};

/**
 * Return the list of statuses a window may transition to from `status`.
 * Unknown statuses (defensive fallback for values outside the PG enum)
 * yield an empty list so the caller rejects the transition.
 */
export function allowedTransitionsFor(status: string): string[] {
  return ALLOWED_STATUS_TRANSITIONS[status] || [];
}

export function isAllowedTransition(from: string, to: string): boolean {
  return allowedTransitionsFor(from).includes(to);
}
