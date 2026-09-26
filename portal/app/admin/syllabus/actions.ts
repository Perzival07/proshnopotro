"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { BOARDS, CLASS_LEVELS, ncertPreset, parseChapterList } from "@/lib/syllabus";

type Result = { success?: true; error?: string; added?: number };

// Like the marking screen, these return what changed rather than revalidating,
// so the page (under the admin loading boundary) keeps its place.

function checkScope(board: string, classLevel: string, subject: string): string | null {
  if (!(BOARDS as readonly string[]).includes(board)) return "Choose a board.";
  if (!(CLASS_LEVELS as readonly string[]).includes(classLevel)) return "Choose a class.";
  if (!subject.trim() || subject.length > 60) return "Choose a subject.";
  return null;
}

export interface ChapterRow {
  id: string;
  name: string;
  position: number;
  questions: number;
}

export async function listChapters(board: string, classLevel: string, subject: string): Promise<ChapterRow[]> {
  await requireAdmin();
  const chapters = await prisma.chapter.findMany({
    where: { board, classLevel, subject },
    orderBy: { position: "asc" },
    include: { _count: { select: { questions: true } } },
  });
  return chapters.map((c) => ({ id: c.id, name: c.name, position: c.position, questions: c._count.questions }));
}

/** Adds chapters at the end of the list, skipping any already there. */
export async function addChapters(
  board: string,
  classLevel: string,
  subject: string,
  text: string
): Promise<Result & { chapters?: ChapterRow[] }> {
  await requireAdmin();
  const bad = checkScope(board, classLevel, subject);
  if (bad) return { error: bad };
  const names = parseChapterList(text);
  if (names.length === 0) return { error: "Write one chapter per line." };
  if (names.length > 80) return { error: "That is more chapters than one subject has; add them in parts." };

  const existing = await prisma.chapter.findMany({ where: { board, classLevel, subject }, select: { name: true, position: true } });
  const known = new Set(existing.map((c) => c.name.toLowerCase()));
  let position = existing.reduce((max, c) => Math.max(max, c.position + 1), 0);
  const fresh = names.filter((n) => !known.has(n.toLowerCase()));
  if (fresh.length) {
    await prisma.chapter.createMany({
      data: fresh.map((name) => ({ board, classLevel, subject, name, position: position++ })),
      skipDuplicates: true,
    });
  }
  return { success: true, added: fresh.length, chapters: await listChapters(board, classLevel, subject) };
}

export async function loadNcertChapters(
  board: string,
  classLevel: string,
  subject: string
): Promise<Result & { chapters?: ChapterRow[] }> {
  await requireAdmin();
  const preset = ncertPreset(classLevel, subject);
  if (!preset) return { error: `There is no NCERT list for Class ${classLevel} ${subject}. Paste the chapters instead.` };
  return addChapters(board, classLevel, subject, preset.join("\n"));
}

export async function renameChapter(id: string, name: string): Promise<Result> {
  await requireAdmin();
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 150) return { error: "Give the chapter a name." };
  const chapter = await prisma.chapter.findUnique({ where: { id } });
  if (!chapter) return { error: "That chapter no longer exists." };
  const clash = await prisma.chapter.findFirst({
    where: { board: chapter.board, classLevel: chapter.classLevel, subject: chapter.subject, name: { equals: clean, mode: "insensitive" }, NOT: { id } },
  });
  if (clash) return { error: "Another chapter already has that name." };
  await prisma.chapter.update({ where: { id }, data: { name: clean } });
  return { success: true };
}

/** Removes a chapter. Questions tagged with it keep everything but the tag. */
export async function deleteChapter(id: string): Promise<Result> {
  await requireAdmin();
  await prisma.chapter.delete({ where: { id } }).catch(() => null);
  return { success: true };
}

/** Moves a chapter one place up or down the list. */
export async function moveChapter(id: string, direction: -1 | 1): Promise<Result & { chapters?: ChapterRow[] }> {
  await requireAdmin();
  const chapter = await prisma.chapter.findUnique({ where: { id } });
  if (!chapter) return { error: "That chapter no longer exists." };
  const list = await prisma.chapter.findMany({
    where: { board: chapter.board, classLevel: chapter.classLevel, subject: chapter.subject },
    orderBy: { position: "asc" },
  });
  const i = list.findIndex((c) => c.id === id);
  const j = i + direction;
  if (j < 0 || j >= list.length) return { success: true, chapters: await listChapters(chapter.board, chapter.classLevel, chapter.subject) };
  [list[i], list[j]] = [list[j], list[i]];
  await prisma.$transaction(list.map((c, position) => prisma.chapter.update({ where: { id: c.id }, data: { position } })));
  return { success: true, chapters: await listChapters(chapter.board, chapter.classLevel, chapter.subject) };
}
