"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface SaveStudentGradeParams {
  assignmentId: string;
  status: "ASSIGNED" | "SUBMITTED";
  score?: number | null;
  maxScore?: number | null;
}

export async function saveStudentGradeAction(params: SaveStudentGradeParams) {
  await requireAdmin();

  const { assignmentId, status, score, maxScore } = params;

  if (!assignmentId) {
    return { error: "Missing assignment ID." };
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { result: true },
  });

  if (!assignment) {
    return { error: "Assignment not found." };
  }

  try {
    if (status === "SUBMITTED") {
      // If a numerical score was provided
      if (typeof score === "number" && !isNaN(score) && typeof maxScore === "number" && !isNaN(maxScore) && maxScore > 0) {
        if (score < 0 || score > maxScore) {
          return { error: `Score must be between 0 and ${maxScore}.` };
        }

        await prisma.result.upsert({
          where: { assignmentId },
          update: {
            score,
            maxScore,
            submittedAt: new Date(),
            responseEmail: assignment.studentEmail,
          },
          create: {
            assignmentId,
            score,
            maxScore,
            submittedAt: new Date(),
            responseEmail: assignment.studentEmail,
          },
        });
      } else if (assignment.result) {
        // If status is submitted but no new score was typed and existing result exists, preserve it
      }

      await prisma.assignment.update({
        where: { id: assignmentId },
        data: { status: "SUBMITTED" },
      });
    } else {
      // Revert to ASSIGNED
      await prisma.assignment.update({
        where: { id: assignmentId },
        data: { status: "ASSIGNED" },
      });

      // Optionally delete result if tutor cleared marks
      if (assignment.result) {
        await prisma.result.delete({
          where: { assignmentId },
        });
      }
    }

    revalidatePath("/admin/roster");
    revalidatePath("/admin/results");
    revalidatePath("/admin/tests");
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    console.error("Error updating grade:", err);
    return { error: err?.message || "Failed to update grade in database." };
  }
}

export async function quickToggleSubmissionAction(assignmentId: string, currentStatus: "ASSIGNED" | "SUBMITTED") {
  await requireAdmin();

  const newStatus = currentStatus === "ASSIGNED" ? "SUBMITTED" : "ASSIGNED";

  try {
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: newStatus },
    });

    revalidatePath("/admin/roster");
    revalidatePath("/admin/results");
    revalidatePath("/");

    return { success: true, newStatus };
  } catch (err: any) {
    return { error: "Failed to toggle status." };
  }
}
