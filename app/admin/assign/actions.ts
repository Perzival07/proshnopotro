"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { EMAIL_REGEX } from "@/lib/students";
import { isAssignmentSubmitted } from "@/lib/assignment-status";
import { parseNewDeadline, REOPEN_DATA } from "@/lib/reassign";

export interface AssignResult {
  success: boolean;
  error?: string;
  newlyAssignedCount: number;
  /** Finished attempts handed back for another go at the new deadline. */
  reassignedCount: number;
  /** How many of those reassignments deleted a recorded score. */
  clearedMarksCount: number;
  /** Students already holding an unfinished copy of this test; left untouched. */
  skippedCount: number;
  skippedEmails: string[];
  /** Students who have finished it and were not asked to be reassigned. */
  alreadySubmittedCount: number;
  alreadySubmittedEmails: string[];
  invalidCount: number;
  invalidEmails: string[];
  /**
   * Set when the requested reassignments would delete recorded marks and the
   * tutor has not agreed to that yet. Nothing is written in that case.
   */
  needsConfirmation?: true;
  gradedEmails?: string[];
}

function emptyResult(): AssignResult {
  return {
    success: false,
    newlyAssignedCount: 0,
    reassignedCount: 0,
    clearedMarksCount: 0,
    skippedCount: 0,
    skippedEmails: [],
    alreadySubmittedCount: 0,
    alreadySubmittedEmails: [],
    invalidCount: 0,
    invalidEmails: [],
  };
}

/**
 * Assigns a test to a list of emails, and optionally gives it back to the ones
 * who have already finished it.
 *
 * A student holds at most one Assignment row per test (the table is unique on
 * that pair), so "assign it again" cannot mean a second row -- it means
 * resetting the row they have. That is only ever done to a finished attempt
 * and only when `reassignSubmitted` asks for it; a student still working on
 * the test is left alone, because resetting them would wipe a clock they are
 * currently running against.
 */
export async function assignTestToStudents(
  testId: string,
  rawEmails: string[],
  dueAtIsoString: string,
  reassignSubmitted: boolean = false,
  clearMarks: boolean = false
): Promise<AssignResult> {
  await requireAdmin();

  if (!testId) {
    return { ...emptyResult(), error: "Please select a test." };
  }

  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) {
    return { ...emptyResult(), error: "Selected test does not exist." };
  }

  const dueAt = new Date(dueAtIsoString);
  if (isNaN(dueAt.getTime())) {
    return { ...emptyResult(), error: "Invalid due date format." };
  }

  // A reassignment additionally has to land in the future. Reopening a closed
  // attempt onto a deadline that has already passed deletes the old marks and
  // still leaves the student looking at "Closed", so it is rejected rather
  // than performed. A plain new assignment keeps its looser rule.
  if (reassignSubmitted) {
    const check = parseNewDeadline(dueAtIsoString);
    if (!check.dueAt) {
      return { ...emptyResult(), error: check.error };
    }
  }

  // 1. Clean and validate email formats
  const validEmailsSet = new Set<string>();
  const invalidEmails: string[] = [];

  for (const raw of rawEmails) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) continue;

    if (EMAIL_REGEX.test(trimmed)) {
      validEmailsSet.add(trimmed);
    } else {
      invalidEmails.push(trimmed);
    }
  }

  const validEmails = Array.from(validEmailsSet);

  if (validEmails.length === 0) {
    return {
      ...emptyResult(),
      error: "No valid email addresses provided.",
      invalidCount: invalidEmails.length,
      invalidEmails,
    };
  }

  // 2. Sort the students who already have this test into the two groups that
  //    are treated differently: finished attempts, which can be handed back,
  //    and open ones, which are always left as they are.
  const existingAssignments = await prisma.assignment.findMany({
    where: {
      testId,
      studentEmail: { in: validEmails },
    },
    select: {
      id: true,
      studentEmail: true,
      status: true,
      result: { select: { id: true } },
    },
  });

  const submitted = existingAssignments.filter(isAssignmentSubmitted);
  const stillOpen = existingAssignments.filter((a) => !isAssignmentSubmitted(a));

  const existingEmailSet = new Set(
    existingAssignments.map((a) => a.studentEmail.toLowerCase())
  );

  const newEmailsToAssign = validEmails.filter(
    (email) => !existingEmailSet.has(email)
  );

  const gradedEmails = submitted
    .filter((a) => a.result)
    .map((a) => a.studentEmail);

  // 3. Deleting recorded marks in bulk is worth a second look, so the first
  //    call comes back asking rather than writing anything at all -- including
  //    the new assignments, so the tutor never has to reason about a half-done
  //    batch.
  if (reassignSubmitted && gradedEmails.length > 0 && !clearMarks) {
    return {
      ...emptyResult(),
      needsConfirmation: true,
      gradedEmails,
      error:
        "Some of these students have recorded marks. Reassigning the test will delete them.",
    };
  }

  // 4. Batch create the genuinely new assignments
  if (newEmailsToAssign.length > 0) {
    await prisma.assignment.createMany({
      data: newEmailsToAssign.map((studentEmail) => ({
        testId,
        studentEmail,
        dueAt,
        status: "ASSIGNED",
      })),
      skipDuplicates: true,
    });
  }

  // 5. Reopen the finished ones, on the new deadline
  let reassignedCount = 0;
  if (reassignSubmitted && submitted.length > 0) {
    const ids = submitted.map((a) => a.id);
    await prisma.$transaction([
      // A surviving Result reads as submitted everywhere, so the reopened test
      // would still be locked; the score has to go with the attempt.
      prisma.result.deleteMany({ where: { assignmentId: { in: ids } } }),
      prisma.assignment.updateMany({
        where: { id: { in: ids } },
        data: { ...REOPEN_DATA, dueAt, assignedAt: new Date() },
      }),
    ]);
    reassignedCount = ids.length;
  }

  revalidatePath("/admin/assign");
  revalidatePath("/admin/tests");
  revalidatePath("/admin/roster");
  revalidatePath("/admin/results");
  revalidatePath("/");

  return {
    success: true,
    newlyAssignedCount: newEmailsToAssign.length,
    reassignedCount,
    clearedMarksCount: reassignSubmitted ? gradedEmails.length : 0,
    skippedCount: stillOpen.length,
    skippedEmails: stillOpen.map((a) => a.studentEmail),
    alreadySubmittedCount: reassignSubmitted ? 0 : submitted.length,
    alreadySubmittedEmails: reassignSubmitted
      ? []
      : submitted.map((a) => a.studentEmail),
    invalidCount: invalidEmails.length,
    invalidEmails,
  };
}
