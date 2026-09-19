"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { parseQuestionPaper, type ImportError, type ImportedPaper } from "@/lib/question-import";
import { normalizeScheme, parseMatrixOptions, parseOptions, sectionalDuration } from "@/lib/paper";
import type { ImportedQuestion } from "@/lib/question-import";

/** How a question's options are stored: a list, or both columns of a matrix. */
function storedOptions(q: Pick<ImportedQuestion, "type" | "options" | "columns">): Prisma.InputJsonValue {
  return (q.type === "MATRIX" ? { rows: q.options, columns: q.columns } : q.options) as unknown as Prisma.InputJsonValue;
}

/** The option ids a stored question has, for checking a change keeps them. */
function optionShape(type: string, options: unknown): string {
  if (type === "MATRIX") {
    const m = parseMatrixOptions(options);
    return `${m.rows.map((o) => o.id).join(",")}|${m.columns.map((o) => o.id).join(",")}`;
  }
  return parseOptions(options).map((o) => o.id).join(",");
}
import type { MarkingScheme } from "@/lib/marking";
import { regradeTest } from "@/lib/grade-attempt";
import { signQuestionImageUpload, type UploadSignature } from "@/lib/cloudinary";

type Result = { success?: true; error?: string; errors?: ImportError[] };

function refresh(testId: string) {
  revalidatePath(`/admin/tests/${testId}/questions`);
  revalidatePath("/admin/tests");
  revalidatePath("/admin/roster");
}

async function loadQuestionTest(testId: string) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { id: true, format: true },
  });
  if (!test) return { error: "Test not found." } as const;
  if (test.format !== "QUESTIONS") {
    return { error: "This test uses a link, not questions written in the portal." } as const;
  }
  return { test } as const;
}

/**
 * How many students have opened the paper. Once anyone has, the paper's
 * shape is fixed -- questions cannot be added, removed or reordered under a
 * student who is answering them -- though wording, keys and marks can still be
 * corrected, which re-marks everyone.
 */
async function startedCount(testId: string): Promise<number> {
  return prisma.assignment.count({ where: { testId, startedAt: { not: null } } });
}

function lockedMessage(started: number) {
  return `${started} ${started === 1 ? "student has" : "students have"} already opened this paper, so questions can no longer be added, removed or reordered. You can still correct a question's wording, answer or marks.`;
}

/** Writes parsed questions into the test, after any it already has. */
async function writePaper(
  tx: Prisma.TransactionClient,
  testId: string,
  paper: ImportedPaper
) {
  const passageIds: string[] = [];
  for (const content of paper.passages) {
    const p = await tx.passage.create({ data: { testId, content }, select: { id: true } });
    passageIds.push(p.id);
  }

  const existing = await tx.testSection.findMany({
    where: { testId },
    select: { id: true, title: true, position: true, _count: { select: { questions: true } } },
    orderBy: { position: "asc" },
  });
  let nextPosition = existing.length;

  for (const section of paper.sections) {
    // A pasted section with the same name as one already in the paper is
    // added to it, so a tutor can paste Physics in two sittings.
    const match = existing.find((s) => s.title.toLowerCase() === section.title.toLowerCase());
    const target = match
      ? { id: match.id, start: match._count.questions }
      : {
          id: (
            await tx.testSection.create({
              data: { testId, title: section.title, position: nextPosition++, attemptLimit: section.attemptLimit },
              select: { id: true },
            })
          ).id,
          start: 0,
        };
    if (match && section.attemptLimit !== null) {
      await tx.testSection.update({ where: { id: match.id }, data: { attemptLimit: section.attemptLimit } });
    }

    await tx.question.createMany({
      data: section.questions.map((q, i) => ({
        sectionId: target.id,
        position: target.start + i,
        type: q.type,
        stem: q.stem,
        options: storedOptions(q),
        answerKey: q.key as unknown as Prisma.InputJsonValue,
        solution: q.solution,
        marksCorrect: q.rule?.correct ?? null,
        marksWrong: q.rule?.wrong ?? null,
        passageId: q.passage !== null ? passageIds[q.passage] : null,
      })),
    });
  }
}

/**
 * Adds pasted questions to the paper, or replaces the whole paper with them.
 * Nothing is written unless the whole paste reads cleanly.
 */
export async function importQuestions(
  testId: string,
  text: string,
  mode: "APPEND" | "REPLACE"
): Promise<Result & { added?: number }> {
  await requireAdmin();
  const loaded = await loadQuestionTest(testId);
  if ("error" in loaded) return { error: loaded.error };

  const paper = parseQuestionPaper(text);
  if (paper.errors.length > 0) {
    return { error: "Fix the problems below, then try again. Nothing was saved.", errors: paper.errors };
  }
  const count = paper.sections.reduce((n, s) => n + s.questions.length, 0);
  if (count === 0) return { error: "No questions were found. Start each one with \"Q1.\"" };

  const started = await startedCount(testId);
  if (started > 0) return { error: lockedMessage(started) };

  await prisma.$transaction(async (tx) => {
    if (mode === "REPLACE") {
      await tx.testSection.deleteMany({ where: { testId } });
      await tx.passage.deleteMany({ where: { testId } });
    }
    await writePaper(tx, testId, paper);
  });

  refresh(testId);
  return { success: true, added: count };
}

/**
 * Rewrites one question from its text form. Once students have started, the
 * question must keep its type and options so their saved answers still mean
 * the same thing; everyone is re-marked straight after.
 */
export async function updateQuestion(questionId: string, text: string): Promise<Result> {
  await requireAdmin();

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, type: true, options: true, section: { select: { testId: true } } },
  });
  if (!question) return { error: "Question not found." };
  const testId = question.section.testId;

  // Section headings and passages are edited elsewhere; here only one question.
  const paper = parseQuestionPaper(text.replace(/^\s*Q\s*\d+\s*[.):]/i, "Q1."));
  if (paper.errors.length > 0) return { error: "Fix the problems below. Nothing was saved.", errors: paper.errors };
  const all = paper.sections.flatMap((s) => s.questions);
  if (all.length !== 1) return { error: "Keep exactly one question in the box." };
  const q = all[0];

  if ((await startedCount(testId)) > 0) {
    const before = optionShape(question.type, question.options);
    const after = optionShape(q.type, storedOptions(q));
    if (q.type !== question.type || before !== after) {
      return {
        error:
          "Students have already answered this paper, so this question must keep its type and its options (A, B, ...). You can still change the wording, the answer and the marks.",
      };
    }
  }

  await prisma.question.update({
    where: { id: questionId },
    data: {
      type: q.type,
      stem: q.stem,
      options: storedOptions(q),
      answerKey: q.key as unknown as Prisma.InputJsonValue,
      solution: q.solution,
      marksCorrect: q.rule?.correct ?? null,
      marksWrong: q.rule?.wrong ?? null,
    },
  });

  await regradeTest(testId);
  refresh(testId);
  return { success: true };
}

/** Drops a question from marking: full marks to everyone who attempted it. */
export async function setQuestionBonus(questionId: string, bonus: boolean): Promise<Result> {
  await requireAdmin();
  const question = await prisma.question.update({
    where: { id: questionId },
    data: { bonus },
    select: { section: { select: { testId: true } } },
  });
  await regradeTest(question.section.testId);
  refresh(question.section.testId);
  return { success: true };
}

export async function deleteQuestion(questionId: string): Promise<Result> {
  await requireAdmin();
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { sectionId: true, position: true, section: { select: { testId: true } } },
  });
  if (!question) return { error: "Question not found." };
  const testId = question.section.testId;

  const started = await startedCount(testId);
  if (started > 0) return { error: lockedMessage(started) };

  await prisma.$transaction([
    prisma.question.delete({ where: { id: questionId } }),
    prisma.question.updateMany({
      where: { sectionId: question.sectionId, position: { gt: question.position } },
      data: { position: { decrement: 1 } },
    }),
  ]);
  // A section left empty goes too.
  await prisma.testSection.deleteMany({ where: { id: question.sectionId, questions: { none: {} } } });

  refresh(testId);
  return { success: true };
}

export async function updateSection(
  sectionId: string,
  data: {
    title: string;
    attemptLimit: number | null;
    instructions: string;
    /** This section's own minutes; null for none. */
    durationMinutes: number | null;
    /** Marks for this section only; null to use the test's. */
    markingScheme: MarkingScheme | null;
  }
): Promise<Result> {
  await requireAdmin();
  const title = data.title.trim();
  if (!title) return { error: "A section needs a name." };
  const limit = data.attemptLimit;
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    return { error: "\"Attempt any\" must be a whole number of at least 1, or blank." };
  }
  const minutes = data.durationMinutes;
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 600)) {
    return { error: "A section's time must be a whole number of minutes, from 1 to 600, or blank." };
  }
  let scheme: MarkingScheme | null = null;
  if (data.markingScheme) {
    scheme = normalizeScheme(data.markingScheme);
    const invalid = schemeProblem(scheme);
    if (invalid) return { error: invalid };
  }

  const current = await prisma.testSection.findUnique({
    where: { id: sectionId },
    select: { testId: true, durationMinutes: true },
  });
  if (!current) return { error: "Section not found." };
  const started = await startedCount(current.testId);
  if (started > 0 && current.durationMinutes !== minutes) {
    return { error: `${started} ${started === 1 ? "student has" : "students have"} already started, so section times can no longer change.` };
  }

  await prisma.testSection.update({
    where: { id: sectionId },
    data: {
      title,
      attemptLimit: limit,
      instructions: data.instructions.trim() || null,
      durationMinutes: minutes,
      markingScheme: scheme ? JSON.parse(JSON.stringify(scheme)) : Prisma.JsonNull,
    },
  });

  // With a time on every section, the test's own time is their total, so the
  // one countdown and the automatic submission cover the whole paper.
  const sections = await prisma.testSection.findMany({
    where: { testId: current.testId },
    select: { id: true, position: true, durationMinutes: true },
  });
  const total = sectionalDuration(sections);
  if (total !== null) {
    await prisma.test.update({ where: { id: current.testId }, data: { durationMinutes: total } });
  }

  await regradeTest(current.testId);
  refresh(current.testId);
  return { success: true };
}

function schemeProblem(scheme: MarkingScheme): string | null {
  for (const rule of [scheme.SINGLE, scheme.MULTIPLE, scheme.INTEGER, scheme.DECIMAL]) {
    if (rule.correct <= 0) return "Marks for a right answer must be more than zero.";
    if (rule.wrong > 0) return "Marks for a wrong answer must be zero or negative.";
  }
  if (scheme.MULTIPLE.partial === "PER_OPTION" && scheme.MULTIPLE.partialPerOption <= 0) {
    return "Partial marks per right option must be more than zero.";
  }
  return null;
}

/** Saves the test's marking scheme and re-marks every closed attempt. */
export async function updateMarkingScheme(testId: string, scheme: MarkingScheme): Promise<Result> {
  await requireAdmin();
  const loaded = await loadQuestionTest(testId);
  if ("error" in loaded) return { error: loaded.error };

  const clean = normalizeScheme(scheme);
  const invalid = schemeProblem(clean);
  if (invalid) return { error: invalid };

  await prisma.test.update({
    where: { id: testId },
    data: { markingScheme: JSON.parse(JSON.stringify(clean)) },
  });
  await regradeTest(testId);
  refresh(testId);
  return { success: true };
}

/** Shows or hides results for an ON_RELEASE test. */
export async function setResultsReleased(testId: string, released: boolean): Promise<Result> {
  await requireAdmin();
  await prisma.test.update({
    where: { id: testId },
    data: { resultsReleasedAt: released ? new Date() : null },
  });
  refresh(testId);
  revalidatePath("/");
  return { success: true };
}

export async function regradeAll(testId: string): Promise<Result & { count?: number }> {
  await requireAdmin();
  const count = await regradeTest(testId);
  refresh(testId);
  return { success: true, count };
}

export async function getQuestionImageSignature(
  testId: string
): Promise<{ upload?: UploadSignature; error?: string }> {
  await requireAdmin();
  const upload = signQuestionImageUpload(`proshnopotro/questions/${testId}`);
  if (!upload) return { error: "Image uploads are not set up (Cloudinary keys are missing)." };
  return { upload };
}

export async function updatePassage(passageId: string, content: string): Promise<Result> {
  await requireAdmin();
  if (!content.trim()) return { error: "A passage cannot be empty." };
  const passage = await prisma.passage.update({
    where: { id: passageId },
    data: { content: content.trim() },
    select: { testId: true },
  });
  refresh(passage.testId);
  return { success: true };
}
