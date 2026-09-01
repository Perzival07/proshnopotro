"use server";

import { getVerifiedSession } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { isAssignmentSubmitted } from "@/lib/assignment-status";
import { revalidatePath } from "next/cache";

export interface FormResolutionResult {
  url?: string;
  error?: string;
}

/**
 * High-security server action.
 * Resolves the Google Form URL on demand ONLY after strict verification.
 * The URL is NEVER serialized into the page HTML or client bundles.
 */
export async function resolveSecureFormUrl(
  assignmentId: string
): Promise<FormResolutionResult> {
  const sessionUser = await getVerifiedSession();
  if (!sessionUser?.email) {
    return { error: "Authentication required. Please sign in again." };
  }

  const normalizedEmail = sessionUser.email.trim().toLowerCase();

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      test: true,
      result: true,
    },
  });

  if (!assignment) {
    return { error: "Assignment not found." };
  }

  // 1. Email ownership verification
  if (assignment.studentEmail.toLowerCase() !== normalizedEmail) {
    return { error: "Unauthorized: This assessment is not assigned to your account." };
  }

  // 2. Submission status verification
  if (isAssignmentSubmitted(assignment)) {
    return { error: "This assessment has already been submitted." };
  }

  // 3. Test active status verification
  if (!assignment.test.active) {
    return { error: "This test has been deactivated by the tutor." };
  }

  // 4. Due date verification
  if (new Date() > new Date(assignment.dueAt)) {
    return { error: "The deadline for this assessment has passed." };
  }

  if (!assignment.test.formUrl) {
    return { error: "Test form URL is not configured. Please contact tutor." };
  }

  return { url: assignment.test.formUrl };
}

/**
 * Allows a student to confirm they completed the form (works for both graded and non-graded forms).
 */
export async function markStudentSubmission(assignmentId: string) {
  const sessionUser = await getVerifiedSession();
  if (!sessionUser?.email) {
    return { error: "Authentication required." };
  }

  const normalizedEmail = sessionUser.email.trim().toLowerCase();

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment) {
    return { error: "Assignment not found." };
  }

  if (assignment.studentEmail.toLowerCase() !== normalizedEmail) {
    return { error: "Unauthorized." };
  }

  try {
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: "SUBMITTED" },
    });

    revalidatePath(`/test/${assignmentId}`);
    revalidatePath("/");
    revalidatePath("/admin/roster");
    revalidatePath("/admin/results");

    return { success: true };
  } catch (err) {
    console.error("Failed to mark student submission:", err);
    return { error: "Database error marking submission." };
  }
}
