"use server";

import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { SCHEME_PRESETS, maxMarksFor } from "@/lib/marking";
import { normalizeScheme, toMarkableSections } from "@/lib/paper";
import { BOARDS, CLASS_LEVELS } from "@/lib/syllabus";
import { SUBJECTS } from "@/lib/subjects";
import { WRITTEN_UPLOAD_MINUTES } from "@/lib/answer-upload";

type Result = { success?: true; error?: string; testId?: string };

export interface BankPaperInput {
  title: string;
  examName: string;
  board: string;
  classLevel: string;
  subject: string;
  year: number;
}

function checkPaper(data: BankPaperInput): string | null {
  if (!data.title.trim()) return "Give the paper a name, like \"Physics 2024\".";
  if (!(BOARDS as readonly string[]).includes(data.board)) return "Choose a board.";
  if (!(CLASS_LEVELS as readonly string[]).includes(data.classLevel)) return "Choose a class.";
  if (!(SUBJECTS as readonly string[]).includes(data.subject)) return "Choose a subject.";
  const thisYear = new Date().getFullYear();
  if (!Number.isInteger(data.year) || data.year < 1990 || data.year > thisYear + 1) return `Enter a year from 1990 to ${thisYear + 1}.`;
  return null;
}

/** A new, empty past paper in the bank; its questions are added on its page. */
export async function createBankPaper(data: BankPaperInput): Promise<Result> {
  await requireAdmin();
  const bad = checkPaper(data);
  if (bad) return { error: bad };
  const test = await prisma.test.create({
    data: {
      title: data.title.trim(),
      examName: data.examName.trim() || null,
      board: data.board,
      classLevel: data.classLevel,
      subject: data.subject,
      year: data.year,
      bank: true,
      active: false,
      format: "QUESTIONS",
      formUrl: "",
      answerSheets: false,
      markingScheme: JSON.parse(JSON.stringify(SCHEME_PRESETS.NO_NEGATIVE.scheme)),
    },
    select: { id: true },
  });
  return { success: true, testId: test.id };
}

export async function updateBankPaper(id: string, data: BankPaperInput): Promise<Result> {
  await requireAdmin();
  const bad = checkPaper(data);
  if (bad) return { error: bad };
  const test = await prisma.test.findUnique({ where: { id }, select: { bank: true } });
  if (!test?.bank) return { error: "That paper is not in the question bank." };
  await prisma.test.update({
    where: { id },
    data: {
      title: data.title.trim(),
      examName: data.examName.trim() || null,
      board: data.board,
      classLevel: data.classLevel,
      subject: data.subject,
      year: data.year,
    },
  });
  return { success: true, testId: id };
}

type SourceQuestion = Prisma.QuestionGetPayload<{ include: { passage: true } }>;

/**
 * Copies questions into a section, bringing their passages along (once per
 * copy) and keeping internal choices together under fresh group names. With
 * `bakeMarks`, each question's marks are written onto it, so a question worth
 * 5 in its old section is still worth 5 in a section marked differently.
 */
async function copyQuestions<Q extends SourceQuestion>(
  tx: Prisma.TransactionClient,
  targetTestId: string,
  sectionId: string,
  startPosition: number,
  questions: Q[],
  marksFor: (q: Q) => { correct: number; wrong: number } | null
) {
  const passageMap = new Map<string, string>();
  const groupMap = new Map<string, string>();
  const token = Date.now().toString(36);
  // A choice with only one side copied is just a question.
  const groupSize = new Map<string, number>();
  for (const q of questions) if (q.choiceGroup) groupSize.set(q.choiceGroup, (groupSize.get(q.choiceGroup) ?? 0) + 1);

  let position = startPosition;
  for (const q of questions) {
    let passageId: string | null = null;
    if (q.passage) {
      passageId = passageMap.get(q.passage.id) ?? null;
      if (!passageId) {
        const p = await tx.passage.create({
          data: { testId: targetTestId, content: q.passage.content, translation: q.passage.translation },
          select: { id: true },
        });
        passageId = p.id;
        passageMap.set(q.passage.id, p.id);
      }
    }
    let choiceGroup: string | null = null;
    if (q.choiceGroup && (groupSize.get(q.choiceGroup) ?? 0) > 1) {
      choiceGroup = groupMap.get(q.choiceGroup) ?? `${token}-${groupMap.size}`;
      groupMap.set(q.choiceGroup, choiceGroup);
    }
    const marks = marksFor(q);
    await tx.question.create({
      data: {
        sectionId,
        position: position++,
        type: q.type,
        stem: q.stem,
        options: q.options as Prisma.InputJsonValue,
        answerKey: q.answerKey as Prisma.InputJsonValue,
        solution: q.solution,
        marksCorrect: marks ? marks.correct : q.marksCorrect,
        marksWrong: marks ? marks.wrong : q.marksWrong,
        bonus: q.bonus,
        passageId,
        translation: q.translation === null ? Prisma.DbNull : (q.translation as Prisma.InputJsonValue),
        choiceGroup,
        chapterId: q.chapterId,
        topic: q.topic,
        videoUrl: q.videoUrl,
      },
    });
  }
}

/** A new practice test from a past paper: every section and question. */
export async function makeTestFromBankPaper(bankId: string): Promise<Result> {
  await requireAdmin();
  const source = await prisma.test.findUnique({
    where: { id: bankId },
    include: {
      sections: { orderBy: { position: "asc" }, include: { questions: { orderBy: { position: "asc" }, include: { passage: true } } } },
    },
  });
  if (!source?.bank) return { error: "That paper is not in the question bank." };
  if (source.sections.every((s) => s.questions.length === 0)) return { error: "This paper has no questions yet." };

  const test = await prisma.$transaction(
    async (tx) => {
      const created = await tx.test.create({
        data: {
          title: `${source.title}${source.year ? ` (${source.year})` : ""} practice`,
          subject: source.subject,
          description: source.examName,
          iconName: source.iconName,
          format: "QUESTIONS",
          formUrl: "",
          markingScheme: (source.markingScheme ?? undefined) as Prisma.InputJsonValue | undefined,
          answerSheets: source.sections.some((s) => s.questions.some((q) => q.type === "SUBJECTIVE")),
          uploadMinutes: source.sections.some((s) => s.questions.some((q) => q.type === "SUBJECTIVE"))
            ? WRITTEN_UPLOAD_MINUTES
            : undefined,
          calculator: source.calculator,
          shuffle: source.shuffle,
          secondLanguage: source.secondLanguage,
          board: source.board,
          classLevel: source.classLevel,
          durationMinutes: source.durationMinutes,
          active: true,
        },
        select: { id: true },
      });
      for (const section of source.sections) {
        const s = await tx.testSection.create({
          data: {
            testId: created.id,
            title: section.title,
            position: section.position,
            instructions: section.instructions,
            attemptLimit: section.attemptLimit,
            durationMinutes: section.durationMinutes,
            markingScheme: (section.markingScheme ?? undefined) as Prisma.InputJsonValue | undefined,
          },
          select: { id: true },
        });
        await copyQuestions(tx, created.id, s.id, 0, section.questions, () => null);
      }
      return created;
    },
    { timeout: 30_000 }
  );
  return { success: true, testId: test.id };
}

/**
 * Adds chosen bank questions to a test, in a section of that name (made if
 * need be). Only into a test nobody has started, as with any added question.
 */
export async function addBankQuestionsToTest(
  questionIds: string[],
  testId: string,
  sectionTitle: string
): Promise<Result & { added?: number }> {
  await requireAdmin();
  if (questionIds.length === 0) return { error: "Tick the questions to add." };
  if (questionIds.length > 200) return { error: "Add at most 200 questions at a time." };
  const title = sectionTitle.trim() || "From the question bank";

  const target = await prisma.test.findUnique({ where: { id: testId }, select: { id: true, format: true, bank: true } });
  if (!target || target.format !== "QUESTIONS") return { error: "Choose a test whose questions are written in the portal." };
  const started = await prisma.assignment.count({ where: { testId, startedAt: { not: null } } });
  if (started > 0) return { error: "Students have already started that test, so questions can no longer be added to it." };

  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds }, section: { test: { bank: true } } },
    include: { passage: true, section: { include: { test: { select: { markingScheme: true } } } } },
  });
  // Keep the order the tutor saw them in.
  const order = new Map(questionIds.map((id, i) => [id, i]));
  questions.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  if (questions.length === 0) return { error: "Those questions are no longer in the bank." };

  const marksFor = (q: (typeof questions)[number]) => {
    const scheme = normalizeScheme(q.section.test.markingScheme);
    const [section] = toMarkableSections([{ ...q.section, questions: [q] }], scheme);
    const s = section.scheme ?? scheme;
    const correct = maxMarksFor(section.questions[0], s);
    const wrong = q.marksWrong ?? (q.type === "SUBJECTIVE" ? 0 : s[q.type].wrong);
    return { correct, wrong };
  };

  await prisma.$transaction(
    async (tx) => {
      let section = await tx.testSection.findFirst({ where: { testId, title } });
      if (!section) {
        const count = await tx.testSection.count({ where: { testId } });
        section = await tx.testSection.create({ data: { testId, title, position: count } });
      }
      const start = await tx.question.count({ where: { sectionId: section.id } });
      await copyQuestions(tx, testId, section.id, start, questions, marksFor);
      if (questions.some((q) => q.type === "SUBJECTIVE")) {
        await tx.test.update({ where: { id: testId }, data: { answerSheets: true } });
        await tx.test.updateMany({
          where: { id: testId, uploadMinutes: { lt: WRITTEN_UPLOAD_MINUTES } },
          data: { uploadMinutes: WRITTEN_UPLOAD_MINUTES },
        });
      }
    },
    { timeout: 30_000 }
  );
  return { success: true, added: questions.length, testId };
}
