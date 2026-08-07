export type ApplicantDecision = "UNDER_REVIEW" | "ACCEPTED" | "REJECTED";

/**
 * PRD §4 / §3c: canonical applicant state machine.
 *
 * SUBMITTED -> UNDER_REVIEW -> ACCEPTED | REJECTED
 * (ACCEPTED then only becomes CONVERTED via the /convert action;
 *  CONVERTED and terminal states can never be reached by a status PATCH.)
 */
export const APPLICANT_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ["UNDER_REVIEW", "ACCEPTED", "REJECTED"],
  UNDER_REVIEW: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
  CONVERTED: [],
};

export function allowedTransitions(status: string): string[] {
  return APPLICANT_TRANSITIONS[status] ?? [];
}

export function canTransition(
  from: string,
  to: string
): { ok: true } | { ok: false; error: string } {
  const allowed = allowedTransitions(from);
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error: `Cannot transition from ${from} to ${to}`,
    };
  }
  return { ok: true };
}