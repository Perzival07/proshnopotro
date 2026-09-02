"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { EMAIL_REGEX } from "@/lib/students";

export interface AssignResult {
  success: boolean;
  error?: string;
  newlyAssignedCount: number;
  skippedCount: number;
  skippedEmails: string[];
  invalidCount: number;
  invalidEmails: string[];
}

export async function assignTestToStudents(
  testId: string,
  rawEmails: string[],
  dueAtIsoString: string
): Promise<AssignResult> {
  await requireAdmin();

  if (!testId) {
    return {
      success: false,
      error: "Please select a test.",
      newlyAssignedCount: 0,
      skippedCount: 0,
      skippedEmails: [],
      invalidCount: 0,
      invalidEmails: [],
    };
  }

  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) {
    return {
      success: false,
      error: "Selected test does not exist.",
      newlyAssignedCount: 0,
      skippedCount: 0,
      skippedEmails: [],
      invalidCount: 0,
      invalidEmails: [],
    };
  }

  const dueAt = new Date(dueAtIsoString);
  if (isNaN(dueAt.getTime())) {
    return {
      success: false,
      error: "Invalid due date format.",
      newlyAssignedCount: 0,
      skippedCount: 0,
      skippedEmails: [],
      invalidCount: 0,
      invalidEmails: [],
    };
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
      success: false,
      error: "No valid email addresses provided.",
      newlyAssignedCount: 0,
      skippedCount: 0,
      skippedEmails: [],
      invalidCount: invalidEmails.length,
      invalidEmails,
    };
  }

  // 2. Identify existing assignments to skip duplicates safely
  const existingAssignments = await prisma.assignment.findMany({
    where: {
      testId,
      studentEmail: { in: validEmails },
    },
    select: { studentEmail: true },
  });

  const existingEmailSet = new Set(
    existingAssignments.map((a) => a.studentEmail.toLowerCase())
  );

  const newEmailsToAssign = validEmails.filter(
    (email) => !existingEmailSet.has(email)
  );
  const skippedEmails = validEmails.filter((email) =>
    existingEmailSet.has(email)
  );

  // 3. Batch create new assignments
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

  revalidatePath("/admin/assign");
  revalidatePath("/admin/tests");
  revalidatePath("/admin/roster");
  revalidatePath("/");

  return {
    success: true,
    newlyAssignedCount: newEmailsToAssign.length,
    skippedCount: skippedEmails.length,
    skippedEmails,
    invalidCount: invalidEmails.length,
    invalidEmails,
  };
}
