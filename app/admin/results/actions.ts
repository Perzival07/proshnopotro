"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface PreviewRow {
  rowIndex: number;
  rawEmail: string;
  normalizedEmail: string;
  rawScore: string;
  parsedScore: number | null;
  parsedMaxScore: number | null;
  isMatched: boolean;
  assignmentId?: string;
  studentName?: string | null;
  currentStatus?: "ASSIGNED" | "SUBMITTED";
  alreadyHadResult?: boolean;
  reason?: string;
}

export interface ImportPreviewResult {
  success: boolean;
  error?: string;
  matchedRows: PreviewRow[];
  unmatchedRows: PreviewRow[];
  invalidRows: PreviewRow[];
  totalParsed: number;
}

function parseScoreString(
  rawScore: string,
  defaultMaxScore: number
): { score: number | null; maxScore: number | null } {
  if (!rawScore || typeof rawScore !== "string") {
    return { score: null, maxScore: null };
  }

  const cleaned = rawScore.trim();

  // Pattern: "45 / 50" or "45.5/50" or "45 of 50"
  const ratioMatch = cleaned.match(/^([\d.]+)\s*(?:\/|of)\s*([\d.]+)$/i);
  if (ratioMatch) {
    const score = parseFloat(ratioMatch[1]);
    const maxScore = parseFloat(ratioMatch[2]);
    if (!isNaN(score) && !isNaN(maxScore)) {
      return { score, maxScore };
    }
  }

  // Simple number: "45"
  const singleMatch = cleaned.match(/^[\d.]+$/);
  if (singleMatch) {
    const score = parseFloat(singleMatch[0]);
    if (!isNaN(score)) {
      return { score, maxScore: defaultMaxScore };
    }
  }

  return { score: null, maxScore: null };
}

export async function previewResultsImport(
  testId: string,
  rows: Array<{ email: string; score: string }>,
  defaultMaxScore: number = 100
): Promise<ImportPreviewResult> {
  await requireAdmin();

  if (!testId) {
    return {
      success: false,
      error: "Please select a test.",
      matchedRows: [],
      unmatchedRows: [],
      invalidRows: [],
      totalParsed: 0,
    };
  }

  // Fetch all assignments for this test
  const existingAssignments = await prisma.assignment.findMany({
    where: { testId },
    include: {
      result: {
        select: { id: true, score: true, maxScore: true },
      },
    },
  });

  const emails = existingAssignments.map((a) => a.studentEmail.toLowerCase());
  const registeredUsers = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true, name: true, className: true },
  });
  const userMap = new Map(registeredUsers.map((u) => [u.email.toLowerCase(), u]));

  const assignmentByEmail = new Map(
    existingAssignments.map((a) => [a.studentEmail.toLowerCase(), a])
  );

  const matchedRows: PreviewRow[] = [];
  const unmatchedRows: PreviewRow[] = [];
  const invalidRows: PreviewRow[] = [];

  rows.forEach((row, index) => {
    const rawEmail = (row.email || "").trim();
    const normalizedEmail = rawEmail.toLowerCase();
    const rawScore = (row.score || "").toString().trim();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      invalidRows.push({
        rowIndex: index + 1,
        rawEmail,
        normalizedEmail,
        rawScore,
        parsedScore: null,
        parsedMaxScore: null,
        isMatched: false,
        reason: "Invalid email address format",
      });
      return;
    }

    const { score, maxScore } = parseScoreString(rawScore, defaultMaxScore);
    if (score === null || maxScore === null) {
      invalidRows.push({
        rowIndex: index + 1,
        rawEmail,
        normalizedEmail,
        rawScore,
        parsedScore: null,
        parsedMaxScore: null,
        isMatched: false,
        reason: "Could not parse numerical score",
      });
      return;
    }

    const assignment = assignmentByEmail.get(normalizedEmail);

    if (assignment) {
      const user = userMap.get(normalizedEmail);
      matchedRows.push({
        rowIndex: index + 1,
        rawEmail,
        normalizedEmail,
        rawScore,
        parsedScore: score,
        parsedMaxScore: maxScore,
        isMatched: true,
        assignmentId: assignment.id,
        studentName: user?.name || null,
        currentStatus: assignment.status,
        alreadyHadResult: Boolean(assignment.result),
      });
    } else {
      unmatchedRows.push({
        rowIndex: index + 1,
        rawEmail,
        normalizedEmail,
        rawScore,
        parsedScore: score,
        parsedMaxScore: maxScore,
        isMatched: false,
        reason: "No assignment exists for this email on this test",
      });
    }
  });

  return {
    success: true,
    matchedRows,
    unmatchedRows,
    invalidRows,
    totalParsed: rows.length,
  };
}

export async function commitResultsImport(
  matchedItems: Array<{
    assignmentId: string;
    score: number;
    maxScore: number;
    responseEmail: string;
  }>
) {
  await requireAdmin();

  if (!matchedItems || matchedItems.length === 0) {
    return { error: "No matched items to import." };
  }

  try {
    let updatedCount = 0;

    // Use transaction to ensure data integrity
    await prisma.$transaction(async (tx) => {
      for (const item of matchedItems) {
        // Upsert Result
        await tx.result.upsert({
          where: { assignmentId: item.assignmentId },
          update: {
            score: item.score,
            maxScore: item.maxScore,
            responseEmail: item.responseEmail,
            submittedAt: new Date(),
          },
          create: {
            assignmentId: item.assignmentId,
            score: item.score,
            maxScore: item.maxScore,
            responseEmail: item.responseEmail,
            submittedAt: new Date(),
          },
        });

        // Update Assignment status to SUBMITTED
        await tx.assignment.update({
          where: { id: item.assignmentId },
          data: {
            status: "SUBMITTED",
          },
        });

        updatedCount++;
      }
    });

    revalidatePath("/admin/results");
    revalidatePath("/admin/roster");
    revalidatePath("/admin/tests");
    revalidatePath("/");

    return { success: true, updatedCount };
  } catch (error) {
    console.error("Error committing results:", error);
    return { error: "Database error committing test results." };
  }
}
