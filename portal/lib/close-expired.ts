import { prisma } from "@/lib/prisma";
import { isAssignmentSubmitted } from "@/lib/assignment-status";
import { attemptDeadline, isTimed, isTimeUp } from "@/lib/exam-timer";
import { gradeAssignment } from "@/lib/grade-attempt";

interface ClosableAssignment {
  id: string;
  status: "ASSIGNED" | "SUBMITTED";
  dueAt: Date | string;
  startedAt?: Date | string | null;
  result?: unknown | null;
  test: { durationMinutes?: number | null; format?: string };
}

/**
 * Closes out timed attempts whose window ran out while nobody was watching.
 *
 * The countdown in the browser submits the attempt when the student is still
 * on the page, but a closed laptop or a dead connection leaves the row saying
 * ASSIGNED forever. Every student-facing page that already loads assignments
 * calls this, so the record catches up the next time they are anywhere in the
 * portal rather than waiting on a background job.
 *
 * Deliberately limited to timed tests and papers answered in the portal: a
 * plainly overdue untimed assignment behind a link is closed, not submitted,
 * and marking it otherwise would misreport it as work the student handed in.
 *
 * Returns the ids it closed so the caller can render them as submitted without
 * re-querying.
 */
export async function closeExpiredAttempts(
  assignments: ClosableAssignment[]
): Promise<Set<string>> {
  // Timed attempts, and any paper answered in the portal: once its deadline
  // has passed with answers saved, it is submitted as it stood. A test behind
  // a link stays as it is -- its answers are in a Google Form the portal
  // cannot see, so marking it submitted would misreport it.
  const expired = assignments.filter(
    (a) =>
      !isAssignmentSubmitted(a) &&
      (isTimed(a) || a.test.format === "QUESTIONS") &&
      a.startedAt &&
      isTimeUp(a)
  );

  if (expired.length === 0) return new Set();

  // One write per attempt, because each records its own deadline as the moment
  // it ended -- the answer upload window runs from there, not from whenever
  // the student happened to come back. Guarded on status so a submission that
  // landed in between is not relabelled as an auto-submit.
  await prisma.$transaction(
    expired.map((a) =>
      prisma.assignment.updateMany({
        where: { id: a.id, status: "ASSIGNED" },
        data: { status: "SUBMITTED", autoSubmitted: true, endedAt: attemptDeadline(a) },
      })
    )
  );

  // Papers written in the portal are marked as they close, here as anywhere.
  for (const a of expired) {
    try {
      await gradeAssignment(a.id);
    } catch (err) {
      console.error("Failed to mark attempt", a.id, err);
    }
  }

  return new Set(expired.map((a) => a.id));
}
