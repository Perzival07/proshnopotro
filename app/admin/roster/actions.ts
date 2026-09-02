"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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

    revalidatePath("/admin/roster");
    revalidatePath("/admin/results");
    revalidatePath("/admin/tests");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("Failed to update student score:", error);
    return { error: "Database error updating student score." };
  }
}

/**
 * Putting a student back on ASSIGNED clears the timer and the tab-switch tally
 * as well as the status. On a timed test a leftover `startedAt` is an expired
 * window, so the attempt would be auto-submitted again the moment they opened
 * it and the tutor's revert would appear to do nothing; a leftover tally would
 * likewise start the retake already on its final warning.
 */
const REOPEN_DATA = {
  status: "ASSIGNED",
  startedAt: null,
  autoSubmitted: false,
  tabSwitches: 0,
} as const;

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

        revalidatePath("/admin/roster");
        revalidatePath("/admin/results");
        revalidatePath("/admin/tests");
        revalidatePath("/");

        return { success: true, clearedMarks: true };
      }
    }

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: newStatus === "ASSIGNED" ? REOPEN_DATA : { status: "SUBMITTED" },
    });

    revalidatePath("/admin/roster");
    revalidatePath("/admin/results");
    revalidatePath("/admin/tests");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("Failed to toggle status:", error);
    return { error: "Database error updating assignment status." };
  }
}
