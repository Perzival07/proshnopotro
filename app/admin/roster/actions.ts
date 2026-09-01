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

export async function toggleAssignmentStatus(
  assignmentId: string,
  newStatus: "ASSIGNED" | "SUBMITTED"
) {
  await requireAdmin();

  if (!assignmentId) {
    return { error: "Missing assignment ID." };
  }

  try {
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: newStatus },
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
