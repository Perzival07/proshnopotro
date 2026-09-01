"use server";

import { getVerifiedSession } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

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
  if (assignment.status === "SUBMITTED" || assignment.result !== null) {
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
