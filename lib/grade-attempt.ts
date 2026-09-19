import { prisma } from "@/lib/prisma";
import { markPaper, type ResponseValue } from "@/lib/marking";
import { normalizeScheme, toMarkableSections } from "@/lib/paper";

/**
 * Marks a closed attempt at a QUESTIONS test and records the score.
 *
 * Called from every path that closes an attempt -- the student finishing, the
 * timer, the tab guard, and attempts found expired later -- and again when the
 * tutor corrects an answer key. It is safe to run any number of times: each
 * run recomputes everything from the saved answers.
 *
 * Does nothing for other kinds of test, or for an attempt still open.
 */
export async function gradeAssignment(assignmentId: string): Promise<void> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      status: true,
      studentEmail: true,
      endedAt: true,
      answersUploadedAt: true,
      test: {
        select: {
          format: true,
          markingScheme: true,
          answerSheets: true,
          sections: { include: { questions: true } },
        },
      },
      responses: { select: { questionId: true, value: true, manualMarks: true } },
    },
  });

  if (!assignment || assignment.test.format !== "QUESTIONS") return;
  if (assignment.status !== "SUBMITTED") return;

  const scheme = normalizeScheme(assignment.test.markingScheme);
  const manual = Object.fromEntries(assignment.responses.map((r) => [r.questionId, r.manualMarks]));
  const sections = toMarkableSections(assignment.test.sections, scheme, manual);
  const answers: Record<string, ResponseValue> = {};
  for (const r of assignment.responses) answers[r.questionId] = r.value as ResponseValue;

  const marked = markPaper(sections, answers, scheme);
  const byQuestion = Object.assign({}, ...marked.sections.map((s) => s.questions));

  await prisma.$transaction([
    ...assignment.responses.map((r) =>
      prisma.questionResponse.update({
        where: { assignmentId_questionId: { assignmentId: assignment.id, questionId: r.questionId } },
        data: {
          marks: byQuestion[r.questionId]?.marks ?? 0,
          status: byQuestion[r.questionId]?.status ?? "UNATTEMPTED",
        },
      })
    ),
    prisma.result.upsert({
      where: { assignmentId: assignment.id },
      create: {
        assignmentId: assignment.id,
        score: marked.score,
        maxScore: marked.maxScore,
        responseEmail: assignment.studentEmail,
      },
      update: { score: marked.score, maxScore: marked.maxScore },
    }),
    // An objective paper has no answer sheets to photograph, so the upload
    // step is closed at once and the student is never asked for one.
    ...(assignment.test.answerSheets || assignment.answersUploadedAt
      ? []
      : [
          prisma.assignment.updateMany({
            where: { id: assignment.id, answersUploadedAt: null },
            data: { answersUploadedAt: assignment.endedAt ?? new Date() },
          }),
        ]),
  ]);
}

/** Re-marks every closed attempt at a test, after its key or marks changed. */
export async function regradeTest(testId: string): Promise<number> {
  const closed = await prisma.assignment.findMany({
    where: { testId, status: "SUBMITTED" },
    select: { id: true },
  });
  for (const { id } of closed) await gradeAssignment(id);
  return closed.length;
}
