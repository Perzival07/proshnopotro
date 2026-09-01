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

  // A well-formed number: "45" or "45.5" (but not "1.2.3" or ".")
  const NUMBER = "\\d+(?:\\.\\d+)?";

  // Pattern: "45 / 50" or "45.5/50" or "45 of 50"
  const ratioMatch = cleaned.match(
    new RegExp(`^(${NUMBER})\\s*(?:\\/|of)\\s*(${NUMBER})$`, "i")
  );
  if (ratioMatch) {
    const score = parseFloat(ratioMatch[1]);
    const maxScore = parseFloat(ratioMatch[2]);
    if (isFinite(score) && isFinite(maxScore) && maxScore > 0) {
      return { score, maxScore };
    }
    return { score: null, maxScore: null };
  }

  // Simple number: "45"
  const singleMatch = cleaned.match(new RegExp(`^${NUMBER}$`));
  if (singleMatch) {
    const score = parseFloat(singleMatch[0]);
    if (isFinite(score)) {
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

    // Parse score if present, otherwise treat as non-graded submission
    let parsedScore: number | null = null;
    let parsedMaxScore: number | null = null;

    if (rawScore && rawScore.trim() !== "") {
      const parsed = parseScoreString(rawScore, defaultMaxScore);
      if (parsed.score === null || parsed.maxScore === null) {
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
      parsedScore = parsed.score;
      parsedMaxScore = parsed.maxScore;
    }

    const assignment = assignmentByEmail.get(normalizedEmail);

    if (assignment) {
      const user = userMap.get(normalizedEmail);
      matchedRows.push({
        rowIndex: index + 1,
        rawEmail,
        normalizedEmail,
        rawScore,
        parsedScore: parsedScore,
        parsedMaxScore: parsedMaxScore,
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
        parsedScore: parsedScore,
        parsedMaxScore: parsedMaxScore,
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
    score?: number | null;
    maxScore?: number | null;
    responseEmail: string;
  }>
) {
  await requireAdmin();

  if (!matchedItems || matchedItems.length === 0) {
    return { error: "No matched items to import." };
  }

  // Validate server-side: never write client-supplied numbers unchecked.
  for (const item of matchedItems) {
    if (!item.assignmentId) {
      return { error: "An imported row is missing its assignment reference." };
    }
    if (typeof item.score === "number" && typeof item.maxScore === "number") {
      if (!isFinite(item.score) || !isFinite(item.maxScore)) {
        return { error: `Non-numeric score for ${item.responseEmail}.` };
      }
      if (item.score < 0 || item.maxScore <= 0) {
        return { error: `Score out of range for ${item.responseEmail}.` };
      }
      if (item.score > item.maxScore) {
        return {
          error: `Score ${item.score} exceeds max ${item.maxScore} for ${item.responseEmail}.`,
        };
      }
    }
  }

  // A CSV can hold several responses for one email; they all resolve to the
  // same assignment. Keep the last one so the count reflects rows actually
  // written rather than rows submitted.
  const itemsByAssignment = new Map<string, (typeof matchedItems)[number]>();
  for (const item of matchedItems) {
    itemsByAssignment.set(item.assignmentId, item);
  }
  const deduplicatedItems = Array.from(itemsByAssignment.values());
  const duplicateCount = matchedItems.length - deduplicatedItems.length;

  try {
    let updatedCount = 0;

    // Use transaction to ensure data integrity
    await prisma.$transaction(async (tx) => {
      for (const item of deduplicatedItems) {
        // If numerical scores are present, upsert Result
        if (typeof item.score === "number" && typeof item.maxScore === "number") {
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
        }

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

    return { success: true, updatedCount, duplicateCount };
  } catch (error) {
    console.error("Error committing results:", error);
    return { error: "Database error committing test results." };
  }
}
