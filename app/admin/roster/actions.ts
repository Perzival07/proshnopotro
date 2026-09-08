"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { canReassign, parseNewDeadline, REOPEN_DATA } from "@/lib/reassign";

/**
 * Every write here changes the same four surfaces: the roster it was made
 * from, the results table, the per-test counts and the student's own
 * dashboard. Naming the set once keeps a new action from quietly refreshing
 * three of them.
 */
function revalidateAdminSurfaces() {
  revalidatePath("/admin/roster");
  revalidatePath("/admin/results");
  revalidatePath("/admin/tests");
  revalidatePath("/");
}

export async function updateStudentScore(
  assignmentId: string,
  score: number,
  maxScore: number,
  studentEmail: string
) {
  await requireAdmin();

  if (!assignmentId) {
    return { error: "Missing assignment ID." };
  }

  if (isNaN(score) || isNaN(maxScore)) {
    return { error: "Score and Max Score must be valid numbers." };
  }

  if (score < 0 || maxScore <= 0) {
    return { error: "Max score must be greater than 0, and score cannot be negative." };
  }

  if (score > maxScore) {
    return { error: `Score (${score}) cannot exceed Max Score (${maxScore}).` };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Upsert the result record
      await tx.result.upsert({
        where: { assignmentId },
        update: {
          score,
          maxScore,
          responseEmail: studentEmail.toLowerCase().trim(),
          submittedAt: new Date(),
        },
        create: {
          assignmentId,
          score,
          maxScore,
          responseEmail: studentEmail.toLowerCase().trim(),
          submittedAt: new Date(),
        },
      });

      // 2. Mark assignment status as SUBMITTED
      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: "SUBMITTED",
        },
      });
    });

    revalidateAdminSurfaces();

    return { success: true };
  } catch (error) {
    console.error("Failed to update student score:", error);
    return { error: "Database error updating student score." };
  }
}

export async function toggleAssignmentStatus(
  assignmentId: string,
  newStatus: "ASSIGNED" | "SUBMITTED",
  clearMarks: boolean = false
) {
  await requireAdmin();

  if (!assignmentId) {
    return { error: "Missing assignment ID." };
  }

  try {
    // The student dashboard, the test page and resolveSecureFormUrl all treat
    // `result !== null` as submitted. Flipping the status column alone while a
    // recorded result remains leaves the badge stuck on "Submitted" and keeps
    // the test locked -- the toggle would silently do nothing. So reverting to
    // ASSIGNED has to remove the result too; because that destroys a recorded
    // grade, the caller must confirm it first.
    if (newStatus === "ASSIGNED") {
      const existing = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: { result: { select: { id: true, score: true, maxScore: true } } },
      });

      if (!existing) {
        return { error: "Assignment not found." };
      }

      if (existing.result && !clearMarks) {
        return {
          needsConfirmation: true as const,
          score: existing.result.score,
          maxScore: existing.result.maxScore,
          error:
            "This student has recorded marks. Reverting to Assigned will delete them.",
        };
      }

      if (existing.result) {
        await prisma.$transaction([
          prisma.result.delete({ where: { assignmentId } }),
          prisma.assignment.update({
            where: { id: assignmentId },
            data: REOPEN_DATA,
          }),
        ]);

        revalidateAdminSurfaces();

        return { success: true, clearedMarks: true };
      }
    }

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: newStatus === "ASSIGNED" ? REOPEN_DATA : { status: "SUBMITTED" },
    });

    revalidateAdminSurfaces();

    return { success: true };
  } catch (error) {
    console.error("Failed to toggle status:", error);
    return { error: "Database error updating assignment status." };
  }
}

export interface ReassignResult {
  success?: true;
  /** True when a recorded score was deleted to make room for the new attempt. */
  clearedMarks?: boolean;
  /** Set when marks would be lost and the tutor has not agreed to that yet. */
  needsConfirmation?: true;
  score?: number;
  maxScore?: number;
  error?: string;
}

/**
 * Hands a finished test back to one student for another attempt.
 *
 * This is not the status toggle under a friendlier name. The toggle reopens an
 * attempt on its original deadline, which for the case a tutor actually cares
 * about -- a paper the timer or the tab guard closed hours ago -- reopens it
 * onto a deadline that has already passed, so the student still sees "Closed".
 * A reassignment therefore takes a fresh deadline, and is only offered on an
 * attempt that is genuinely finished.
 *
 * The previous marks cannot be kept: every consumer reads `result != null` as
 * submitted, so a surviving Result would leave the test locked. Because that
 * makes the reassignment destructive, a graded student comes back as
 * needsConfirmation the first time and is only reopened once the tutor agrees.
 */
export async function reassignAssignment(
  assignmentId: string,
  dueAtIsoString: string,
  clearMarks: boolean = false
): Promise<ReassignResult> {
  await requireAdmin();

  if (!assignmentId) {
    return { error: "Missing assignment ID." };
  }

  const parsedDeadline = parseNewDeadline(dueAtIsoString);
  if (!parsedDeadline.dueAt) {
    return { error: parsedDeadline.error };
  }

  try {
    const existing = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        status: true,
        result: { select: { id: true, score: true, maxScore: true } },
      },
    });

    if (!existing) {
      return { error: "Assignment not found." };
    }

    if (!canReassign(existing)) {
      return {
        error:
          "This student has not submitted yet, so there is nothing to reassign. Change their deadline instead.",
      };
    }

    if (existing.result && !clearMarks) {
      return {
        needsConfirmation: true,
        score: existing.result.score,
        maxScore: existing.result.maxScore,
        error:
          "This student has recorded marks. Reassigning the test will delete them.",
      };
    }

    // assignedAt moves too: this is a fresh handout, and the roster's default
    // sort is on that column, so the student just given another go sits at the
    // top of the list where the tutor is already looking.
    const reopen = {
      ...REOPEN_DATA,
      dueAt: parsedDeadline.dueAt,
      assignedAt: new Date(),
    };

    if (existing.result) {
      await prisma.$transaction([
        prisma.result.delete({ where: { assignmentId } }),
        prisma.assignment.update({ where: { id: assignmentId }, data: reopen }),
      ]);
    } else {
      await prisma.assignment.update({
        where: { id: assignmentId },
        data: reopen,
      });
    }

    revalidateAdminSurfaces();

    return { success: true, clearedMarks: Boolean(existing.result) };
  } catch (error) {
    console.error("Failed to reassign test:", error);
    return { error: "Database error reassigning this test." };
  }
}
