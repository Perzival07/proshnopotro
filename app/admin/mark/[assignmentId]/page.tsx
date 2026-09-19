import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signedAnswerUrl } from "@/lib/cloudinary";
import { sanitizeAnnotations } from "@/lib/annotations";
import { markPaper, maxMarksFor, type ResponseValue } from "@/lib/marking";
import { normalizeScheme, toMarkableSections } from "@/lib/paper";
import { MarkingWorkspace, type MarkingQuestion } from "./MarkingWorkspace";

export const dynamic = "force-dynamic";

export default async function MarkAttemptPage({ params }: { params: { assignmentId: string } }) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: params.assignmentId },
    include: {
      test: {
        select: {
          id: true,
          title: true,
          subject: true,
          format: true,
          markingScheme: true,
          sections: { orderBy: { position: "asc" }, include: { questions: { orderBy: { position: "asc" } } } },
        },
      },
      responses: { select: { questionId: true, value: true, manualMarks: true, feedback: true } },
      answerImages: { orderBy: { position: "asc" } },
      result: { select: { score: true, maxScore: true } },
    },
  });
  if (!assignment) notFound();

  const student = await prisma.user.findUnique({
    where: { email: assignment.studentEmail },
    select: { name: true, className: true },
  });

  const pages = assignment.answerImages.map((image) => ({
    id: image.id,
    url: signedAnswerUrl(image, 1600),
    thumb: signedAnswerUrl(image, 240),
    width: image.width ?? 1200,
    height: image.height ?? 1600,
    annotations:
      sanitizeAnnotations(image.annotations, { width: image.width ?? 4000, height: image.height ?? 4000 }) ?? [],
  }));

  // Paper written in the portal: every question with how it stands.
  let questions: MarkingQuestion[] | null = null;
  if (assignment.test.format === "QUESTIONS") {
    const scheme = normalizeScheme(assignment.test.markingScheme);
    const manual = Object.fromEntries(assignment.responses.map((r) => [r.questionId, r.manualMarks]));
    const feedback = new Map(assignment.responses.map((r) => [r.questionId, r.feedback]));
    const answers: Record<string, ResponseValue> = {};
    for (const r of assignment.responses) answers[r.questionId] = r.value as ResponseValue;
    const markable = toMarkableSections(assignment.test.sections, scheme, manual);
    const marked = markPaper(markable, answers, scheme);

    questions = [];
    let number = 0;
    assignment.test.sections.forEach((section, si) => {
      section.questions.forEach((q, qi) => {
        const alternative = !!q.choiceGroup && qi > 0 && section.questions[qi - 1].choiceGroup === q.choiceGroup;
        if (!alternative) number++;
        const m = markable[si].questions.find((x) => x.id === q.id)!;
        questions!.push({
          id: q.id,
          number,
          alternative,
          choiceGroup: q.choiceGroup,
          section: section.title,
          type: q.type,
          stem: q.stem,
          solution: q.solution,
          max: maxMarksFor(m, markable[si].scheme ?? scheme),
          status: marked.sections[si].questions[q.id].status,
          marks: marked.sections[si].questions[q.id].marks,
          manualMarks: manual[q.id] ?? null,
          feedback: feedback.get(q.id) ?? "",
        });
      });
    });
  }

  // The test's other submitted attempts, for Previous / Next.
  const queue = await prisma.assignment.findMany({
    where: { testId: assignment.testId, status: "SUBMITTED" },
    select: { id: true },
    orderBy: { studentEmail: "asc" },
  });
  const index = queue.findIndex((a) => a.id === assignment.id);

  return (
    <MarkingWorkspace
      assignment={{
        id: assignment.id,
        submitted: assignment.status === "SUBMITTED",
        studentEmail: assignment.studentEmail,
        studentName: student?.name ?? null,
        className: student?.className ?? null,
        endedAt: assignment.endedAt?.toISOString() ?? null,
        feedback: assignment.feedback ?? "",
        returnedAt: assignment.returnedAt?.toISOString() ?? null,
        result: assignment.result,
      }}
      test={{ id: assignment.test.id, title: assignment.test.title, subject: assignment.test.subject }}
      pages={pages}
      questions={questions}
      queue={{
        index,
        total: queue.length,
        prev: index > 0 ? queue[index - 1].id : null,
        next: index >= 0 && index < queue.length - 1 ? queue[index + 1].id : null,
      }}
    />
  );
}
