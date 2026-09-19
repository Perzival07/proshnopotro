import React from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { maxMarksFor, QUESTION_TYPES, type QuestionType } from "@/lib/marking";
import { normalizeScheme, parseMatrixOptions, parseOptions, toMarkableSections } from "@/lib/paper";
import { QuestionBrowser, type BankQuestion } from "./QuestionBrowser";

export const dynamic = "force-dynamic";

const LIMIT = 100;

export default async function BankQuestionsPage({
  searchParams,
}: {
  searchParams: { board?: string; class?: string; subject?: string; year?: string; chapter?: string; type?: string; q?: string };
}) {
  const board = searchParams.board || "";
  const classLevel = searchParams.class || "";
  const subject = searchParams.subject || "";
  const year = searchParams.year ? Number(searchParams.year) || null : null;
  const type = (QUESTION_TYPES as readonly string[]).includes(searchParams.type ?? "") ? (searchParams.type as QuestionType) : null;
  const text = (searchParams.q ?? "").trim().slice(0, 100);

  const where: Prisma.QuestionWhereInput = {
    section: {
      test: {
        bank: true,
        ...(board ? { board } : {}),
        ...(classLevel ? { classLevel } : {}),
        ...(subject ? { subject } : {}),
        ...(year ? { year } : {}),
      },
    },
    ...(searchParams.chapter ? { chapterId: searchParams.chapter } : {}),
    ...(type ? { type } : {}),
    ...(text
      ? { OR: [{ stem: { contains: text, mode: "insensitive" } }, { topic: { contains: text, mode: "insensitive" } }] }
      : {}),
  };

  const [found, total, chapters, targets] = await Promise.all([
    prisma.question.findMany({
      where,
      take: LIMIT,
      orderBy: [{ section: { test: { year: "desc" } } }, { section: { position: "asc" } }, { position: "asc" }],
      include: {
        chapter: { select: { name: true } },
        section: { include: { test: { select: { id: true, title: true, year: true, markingScheme: true } } } },
      },
    }),
    prisma.question.count({ where }),
    board && classLevel && subject
      ? prisma.chapter.findMany({ where: { board, classLevel, subject }, orderBy: { position: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
    // Tests questions can go into: written in the portal, not a bank paper,
    // and not yet opened by any student.
    prisma.test.findMany({
      where: { bank: false, format: "QUESTIONS", assignments: { none: { startedAt: { not: null } } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, sections: { orderBy: { position: "asc" }, select: { title: true } } },
    }),
  ]);

  const questions: BankQuestion[] = found.map((q) => {
    const scheme = normalizeScheme(q.section.test.markingScheme);
    const [section] = toMarkableSections([{ ...q.section, questions: [q] }], scheme);
    return {
      id: q.id,
      type: q.type,
      stem: q.stem,
      options: q.type === "MATRIX" ? parseMatrixOptions(q.options).rows : parseOptions(q.options),
      marks: maxMarksFor(section.questions[0], section.scheme ?? scheme),
      paper: q.section.test.title,
      paperId: q.section.test.id,
      year: q.section.test.year,
      chapter: q.chapter?.name ?? null,
      topic: q.topic,
      hasPassage: !!q.passageId,
    };
  });

  return (
    <QuestionBrowser
      questions={questions}
      total={total}
      limit={LIMIT}
      chapters={chapters}
      targets={targets.map((t) => ({ id: t.id, title: t.title, sections: t.sections.map((s) => s.title) }))}
      filters={{
        board,
        classLevel,
        subject,
        year: searchParams.year ?? "",
        chapter: searchParams.chapter ?? "",
        type: type ?? "",
        q: text,
      }}
    />
  );
}
