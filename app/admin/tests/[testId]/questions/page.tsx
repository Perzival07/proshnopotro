import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeScheme, parseAnswerKey, parseMatrixOptions, parseOptions } from "@/lib/paper";
import { PaperEditor, type EditorSection } from "./PaperEditor";
import { parseTranslation } from "@/lib/translation";

export const dynamic = "force-dynamic";

export default async function TestQuestionsPage({ params }: { params: { testId: string } }) {
  const test = await prisma.test.findUnique({
    where: { id: params.testId },
    select: {
      id: true,
      title: true,
      subject: true,
      format: true,
      markingScheme: true,
      resultRelease: true,
      resultsReleasedAt: true,
      secondLanguage: true,
      board: true,
      classLevel: true,
      bank: true,
      year: true,
      examName: true,
      passages: { select: { id: true, content: true, translation: true } },
      sections: {
        orderBy: { position: "asc" },
        include: { questions: { orderBy: { position: "asc" } } },
      },
      _count: { select: { assignments: true } },
    },
  });
  if (!test || test.format !== "QUESTIONS") notFound();

  const chapters =
    test.board && test.classLevel
      ? await prisma.chapter.findMany({
          where: { board: test.board, classLevel: test.classLevel, subject: test.subject },
          orderBy: { position: "asc" },
          select: { id: true, name: true },
        })
      : [];

  const [started, submitted] = await Promise.all([
    prisma.assignment.count({ where: { testId: test.id, startedAt: { not: null } } }),
    prisma.assignment.count({ where: { testId: test.id, status: "SUBMITTED" } }),
  ]);

  const sections: EditorSection[] = test.sections.map((s) => ({
    id: s.id,
    title: s.title,
    attemptLimit: s.attemptLimit,
    instructions: s.instructions,
    durationMinutes: s.durationMinutes,
    scheme: s.markingScheme ? normalizeScheme(s.markingScheme) : null,
    questions: s.questions.map((q) => ({
      id: q.id,
      type: q.type,
      stem: q.stem,
      options: q.type === "MATRIX" ? parseMatrixOptions(q.options).rows : parseOptions(q.options),
      columns: q.type === "MATRIX" ? parseMatrixOptions(q.options).columns : [],
      key: parseAnswerKey(q.type, q.answerKey),
      solution: q.solution,
      marksCorrect: q.marksCorrect,
      marksWrong: q.marksWrong,
      bonus: q.bonus,
      passageId: q.passageId,
      translation: parseTranslation(q.translation),
      choiceGroup: q.choiceGroup,
      chapterId: q.chapterId,
      topic: q.topic,
      videoUrl: q.videoUrl,
    })),
  }));

  return (
    <PaperEditor
      test={{
        id: test.id,
        title: test.title,
        subject: test.subject,
        resultRelease: test.resultRelease,
        released: test.resultsReleasedAt !== null,
        assigned: test._count.assignments,
        started,
        submitted,
        secondLanguage: test.secondLanguage,
        syllabus: test.board && test.classLevel ? `${test.board} Class ${test.classLevel} ${test.subject}` : null,
        bank: test.bank,
        year: test.year,
        examName: test.examName,
      }}
      chapters={chapters}
      scheme={normalizeScheme(test.markingScheme)}
      sections={sections}
      passages={test.passages}
    />
  );
}
