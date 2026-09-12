import { prisma } from "@/lib/prisma";
import { isAssignmentSubmitted } from "@/lib/assignment-status";
import { attemptDeadline, isTimed, isTimeUp } from "@/lib/exam-timer";

interface ClosableAssignment {
  id: string;
  status: "ASSIGNED" | "SUBMITTED";
  dueAt: Date | string;
  startedAt?: Date | string | null;
  result?: unknown | null;
  test: { durationMinutes?: number | null };
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
 * Deliberately limited to timed tests: a plainly overdue untimed assignment is
 * closed, not submitted, and marking it otherwise would misreport it as work
 * the student handed in.
 *
 * Returns the ids it closed so the caller can render them as submitted without
 * re-querying.
 */
export async function closeExpiredAttempts(
  assignments: ClosableAssignment[]
): Promise<Set<string>> {
  const expired = assignments.filter(
    (a) => !isAssignmentSubmitted(a) && isTimed(a) && a.startedAt && isTimeUp(a)
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

  return new Set(expired.map((a) => a.id));
}
