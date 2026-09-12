import { isAssignmentSubmitted } from "./assignment-status";

/**
 * Giving a finished attempt back to a student.
 *
 * A student gets one Assignment row per test -- the table is unique on
 * (testId, studentEmail) -- so a second chance cannot be a second row. It is
 * the same row reset to its opening state, which is what every rule here is
 * about: what must be cleared, and which attempts are even eligible.
 */

/**
 * The columns that put a finished attempt back in front of the student.
 *
 * All of them have to move together. A leftover `startedAt` is an expired window,
 * so a timed test would auto-submit itself the moment the student opened it
 * and the reassignment would appear to do nothing; a leftover `tabSwitches`
 * tally would start the retake already on its final warning; a leftover
 * `autoSubmitted` would label the fresh attempt as one the timer ended; and a
 * leftover upload stamp would refuse the retake's answer photos.
 *
 * Scalars only, so it works in `updateMany` too. The old attempt's photo rows
 * must be deleted alongside it -- see `clearAnswerImages`.
 */
export const REOPEN_DATA = {
  status: "ASSIGNED",
  startedAt: null,
  autoSubmitted: false,
  tabSwitches: 0,
  endedAt: null,
  answersUploadedAt: null,
} as const;

/**
 * Whether this attempt is finished and can therefore be handed back.
 *
 * Only submitted attempts qualify -- student-submitted and auto-submitted
 * alike, since the tutor's reason for a second chance (a timer that ran out,
 * a tab guard that fired) usually is the auto-submit. An attempt still open
 * needs its deadline moved, not a reset that would wipe the clock it is
 * already running on.
 */
export function canReassign(assignment: {
  status: "ASSIGNED" | "SUBMITTED";
  result?: unknown | null;
}): boolean {
  return isAssignmentSubmitted(assignment);
}

export interface DeadlineParseResult {
  dueAt?: Date;
  error?: string;
}

/**
 * Reads the new deadline for a reassignment.
 *
 * A deadline in the past is rejected rather than accepted quietly: the student
 * card derives "Closed" from it, so a backdated reassignment would delete the
 * old marks and still leave the student with no way in.
 */
export function parseNewDeadline(
  input: string | null | undefined,
  now: Date = new Date()
): DeadlineParseResult {
  if (!input || !String(input).trim()) {
    return { error: "Please choose a new deadline for this attempt." };
  }

  const dueAt = new Date(input);
  if (isNaN(dueAt.getTime())) {
    return { error: "That deadline is not a valid date and time." };
  }

  if (dueAt.getTime() <= now.getTime()) {
    return {
      error:
        "The new deadline is in the past, so the test would close again immediately. Pick a future date and time.",
    };
  }

  return { dueAt };
}
