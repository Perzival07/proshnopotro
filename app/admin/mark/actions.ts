"use server";

import { Prisma } from "@prisma/client";
import { requireStaff, studentScope, type SessionUser } from "@/lib/auth-utils";
import { canAccessStudent } from "@/lib/permissions";
import { destroyAnswerImages } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { sanitizeAnnotations } from "@/lib/annotations";
import { gradeAssignment } from "@/lib/grade-attempt";
import { maxMarksFor } from "@/lib/marking";
import { normalizeScheme, toMarkableSections } from "@/lib/paper";

type Result = { success?: true; error?: string };

/**
 * A tutor marks only the students in their classrooms; the owner marks
 * anyone. Returns the reason when this attempt is not the caller's to mark.
 */
async function notYours(user: SessionUser, assignmentId: string): Promise<string | null> {
  const scope = await studentScope(user);
  if (scope === null) return null;
  const a = await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { studentEmail: true } });
  if (!a || !canAccessStudent(scope, a.studentEmail)) return "That attempt is not in your classrooms.";
  return null;
}

// No revalidatePath here, on purpose. The admin area has a loading boundary,
// and a server action that revalidates makes the page under it remount --
// which would throw the tutor back to page 1 of the answer sheets after every
// saved stroke. Each action returns what changed instead; the pages students
// and the roster load are rendered fresh on every visit anyway.

/** The tutor's pen, ticks and notes on one page, replacing what was there. */
export async function saveAnnotations(imageId: string, raw: unknown): Promise<Result> {
  const user = await requireStaff();
  const image = await prisma.answerImage.findUnique({
    where: { id: imageId },
    select: { id: true, width: true, height: true, assignmentId: true },
  });
  if (!image) return { error: "That page no longer exists." };
  const denied = await notYours(user, image.assignmentId);
  if (denied) return { error: denied };
  const annotations = sanitizeAnnotations(raw, {
    width: image.width ?? 4000,
    height: image.height ?? 4000,
  });
  if (!annotations) return { error: "Too many marks on one page to save." };

  await prisma.answerImage.update({
    where: { id: imageId },
    data: { annotations: annotations.length ? (annotations as unknown as Prisma.InputJsonValue) : Prisma.DbNull },
  });
  return { success: true };
}

/**
 * Marks for one written answer (null to unmark), and a comment for the
 * student. Re-marks the whole attempt, so the total is right at once.
 */
export async function saveWrittenMark(
  assignmentId: string,
  questionId: string,
  marks: number | null,
  feedback: string
): Promise<Result & { score?: number; maxScore?: number }> {
  const user = await requireStaff();
  const denied = await notYours(user, assignmentId);
  if (denied) return { error: denied };
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, status: true, testId: true, test: { select: { markingScheme: true } } },
  });
  if (!assignment) return { error: "That attempt no longer exists." };
  if (assignment.status !== "SUBMITTED") return { error: "The student has not submitted this attempt yet." };

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { section: true },
  });
  if (!question || question.section.testId !== assignment.testId) return { error: "That question is not in this paper." };
  if (question.type !== "SUBJECTIVE") return { error: "Only written answers are marked by hand." };

  if (marks !== null) {
    if (!Number.isFinite(marks) || marks < 0) return { error: "Marks must be 0 or more." };
    const scheme = normalizeScheme(assignment.test.markingScheme);
    const [markable] = toMarkableSections(
      [{ ...question.section, questions: [question] }],
      scheme
    );
    const max = maxMarksFor(markable.questions[0], markable.scheme ?? scheme);
    if (marks > max) return { error: `This question is out of ${max}.` };
    if (Math.round(marks * 2) !== marks * 2) return { error: "Use whole or half marks." };
  }
  const note = feedback.trim().slice(0, 2000) || null;

  await prisma.questionResponse.upsert({
    where: { assignmentId_questionId: { assignmentId, questionId } },
    create: { assignmentId, questionId, value: Prisma.JsonNull, manualMarks: marks, feedback: note },
    update: { manualMarks: marks, feedback: note },
  });
  await gradeAssignment(assignmentId);

  const result = await prisma.result.findUnique({ where: { assignmentId }, select: { score: true, maxScore: true } });
  return { success: true, score: result?.score, maxScore: result?.maxScore };
}

/** For a paper behind a link: the whole attempt's marks, entered as a total. */
export async function saveTotalMarks(
  assignmentId: string,
  score: number,
  maxScore: number
): Promise<Result> {
  const user = await requireStaff();
  const denied = await notYours(user, assignmentId);
  if (denied) return { error: denied };
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
    return { error: "Enter marks from 0 up to the total, and a total above 0." };
  }
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { studentEmail: true, status: true },
  });
  if (!assignment) return { error: "That attempt no longer exists." };
  if (assignment.status !== "SUBMITTED") return { error: "The student has not submitted this attempt yet." };

  await prisma.result.upsert({
    where: { assignmentId },
    create: { assignmentId, score, maxScore, responseEmail: assignment.studentEmail },
    update: { score, maxScore },
  });
  return { success: true };
}

export async function saveOverallFeedback(assignmentId: string, feedback: string): Promise<Result> {
  const user = await requireStaff();
  const denied = await notYours(user, assignmentId);
  if (denied) return { error: denied };
  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { feedback: feedback.trim().slice(0, 5000) || null },
  });
  return { success: true };
}

/**
 * Hands the marked copy back to the student -- their written marks, comments
 * and the marked-up pages appear on their result -- or takes it back to keep
 * marking.
 */
export async function setReturned(assignmentId: string, returned: boolean): Promise<Result> {
  const user = await requireStaff();
  const denied = await notYours(user, assignmentId);
  if (denied) return { error: denied };
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { status: true },
  });
  if (!a) return { error: "That attempt no longer exists." };
  if (returned && a.status !== "SUBMITTED") return { error: "The student has not submitted this attempt yet." };
  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { returnedAt: returned ? new Date() : null },
  });
  return { success: true };
}

/**
 * Deletes an attempt's answer photos to free storage: the files from
 * Cloudinary first, then their rows, and only those confirmed gone, so a
 * failure leaves the attempt as it was and can simply be tried again. Marks,
 * comments and feedback stay; only the pictures (and the marks drawn on them)
 * go. Refused while the student's upload is still open, or they could upload
 * again into a copy that has just been cleared.
 */
async function removePhotos(assignmentIds: string[]): Promise<{ removed: number; failed: number }> {
  const images = await prisma.answerImage.findMany({
    where: { assignmentId: { in: assignmentIds } },
    select: { id: true, publicId: true, assignmentId: true },
  });
  if (images.length === 0) return { removed: 0, failed: 0 };

  const { gone, failed } = await destroyAnswerImages(images.map((i) => i.publicId));
  const goneSet = new Set(gone);
  const rows = images.filter((i) => goneSet.has(i.publicId));
  if (rows.length > 0) {
    await prisma.$transaction([
      prisma.answerImage.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } }),
      // Stamp the attempts that now have none left.
      prisma.assignment.updateMany({
        where: { id: { in: Array.from(new Set(rows.map((r) => r.assignmentId))) }, answerImages: { none: {} } },
        data: { photosDeletedAt: new Date() },
      }),
    ]);
  }
  return { removed: rows.length, failed: failed.length };
}

export async function deleteAnswerPhotos(assignmentId: string): Promise<Result & { removed?: number }> {
  const user = await requireStaff();
  const denied = await notYours(user, assignmentId);
  if (denied) return { error: denied };
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { status: true, answersUploadedAt: true },
  });
  if (!a || a.status !== "SUBMITTED") return { error: "The student has not submitted this attempt yet." };
  if (!a.answersUploadedAt) return { error: "The student's upload is still open. Wait until it has closed." };

  const res = await removePhotos([assignmentId]);
  if (res.failed > 0) {
    return { error: `${res.failed} ${res.failed === 1 ? "photo" : "photos"} could not be removed from storage. Nothing else was changed for ${res.failed === 1 ? "it" : "them"}; try again in a moment.`, removed: res.removed };
  }
  return { success: true, removed: res.removed };
}

/**
 * Deletes the photos of every copy of a test that has been returned to the
 * student: the ones the tutor is finished with. The caller's own students
 * only, and never a copy still waiting to be marked or returned.
 */
export async function deleteReturnedPhotos(testId: string): Promise<Result & { removed?: number; copies?: number }> {
  const user = await requireStaff();
  const scope = await studentScope(user);
  const attempts = await prisma.assignment.findMany({
    where: {
      testId,
      status: "SUBMITTED",
      returnedAt: { not: null },
      answersUploadedAt: { not: null },
      answerImages: { some: {} },
      ...(scope === null ? {} : { studentEmail: { in: scope } }),
    },
    select: { id: true },
  });
  if (attempts.length === 0) return { success: true, removed: 0, copies: 0 };
  const res = await removePhotos(attempts.map((a) => a.id));
  if (res.failed > 0) {
    return { error: `${res.failed} ${res.failed === 1 ? "photo" : "photos"} could not be removed from storage; the rest were. Try again for the remainder.`, removed: res.removed, copies: attempts.length };
  }
  return { success: true, removed: res.removed, copies: attempts.length };
}
