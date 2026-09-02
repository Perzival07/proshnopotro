import { isTimeUp } from "./exam-timer";

/**
 * Single source of truth for "has this assignment been submitted?".
 *
 * A recorded Result implies submission even if the status column still says
 * ASSIGNED, so both must be consulted. This rule was previously copy-pasted
 * into the student card, the test page, resolveSecureFormUrl and the roster
 * table; each copy was a chance for them to drift apart, and they did -- an
 * admin action that changed only `status` left every consumer still reading
 * the row as submitted. Import this instead of re-deriving it.
 */
export function isAssignmentSubmitted(assignment: {
  status: "ASSIGNED" | "SUBMITTED";
  result?: unknown | null;
}): boolean {
  return assignment.status === "SUBMITTED" || assignment.result != null;
}

/** Whether the deadline has passed, relative to `now` (injectable for tests). */
export function isPastDue(dueAt: Date | string, now: Date = new Date()): boolean {
  return now.getTime() > new Date(dueAt).getTime();
}

export type CardStatus = "AVAILABLE" | "SUBMITTED" | "CLOSED";

/**
 * The status a student's test card should show.
 *
 * `isTimeUp` rather than `isPastDue`: on a timed test a student whose personal
 * window has run out is finished even though the tutor's deadline is hours
 * away, and the card must not keep offering them a way back in.
 */
export function deriveCardStatus(
  assignment: {
    status: "ASSIGNED" | "SUBMITTED";
    dueAt: Date | string;
    startedAt?: Date | string | null;
    result?: unknown | null;
    test: { active: boolean; durationMinutes?: number | null };
  },
  now: Date = new Date()
): CardStatus {
  if (isAssignmentSubmitted(assignment)) return "SUBMITTED";
  if (!assignment.test.active) return "CLOSED";
  if (isTimeUp(assignment, now)) return "CLOSED";
  return "AVAILABLE";
}
