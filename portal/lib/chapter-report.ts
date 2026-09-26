/**
 * Marks by chapter, from a marked paper: what a student scored in each
 * chapter the paper's questions are tagged with, out of what it offered.
 *
 * Built from the same marking as the score, so it always adds up to it. An
 * internal choice is one question: it counts under the chapter of the side
 * that counted, at the choice's maximum.
 */

import { maxMarksFor, type MarkableSection, type PaperMark } from "./marking";

export interface ChapterLine {
  /** null for untagged questions. */
  chapterId: string | null;
  questions: number;
  scored: number;
  max: number;
}

export function chapterBreakdown(
  sections: MarkableSection[],
  marked: PaperMark,
  chapterOf: Record<string, string | null | undefined>,
  testScheme: Parameters<typeof maxMarksFor>[1]
): ChapterLine[] {
  const lines = new Map<string | null, ChapterLine>();
  const add = (chapterId: string | null, scored: number, max: number) => {
    const line = lines.get(chapterId) ?? { chapterId, questions: 0, scored: 0, max: 0 };
    line.questions++;
    line.scored += scored;
    line.max += max;
    lines.set(chapterId, line);
  };

  sections.forEach((section, si) => {
    const scheme = section.scheme ?? testScheme;
    const marks = marked.sections[si].questions;
    const answered = (id: string) => !["NOT_COUNTED", "UNATTEMPTED", "PENDING"].includes(marks[id].status);

    // Units in paper order: a question, or an internal choice.
    const units: { counted: string; max: number; answered: boolean }[] = [];
    const seen = new Set<string>();
    for (const q of section.questions) {
      const unit = q.choiceGroup ?? q.id;
      if (seen.has(unit)) continue;
      seen.add(unit);
      const members = q.choiceGroup ? section.questions.filter((x) => x.choiceGroup === q.choiceGroup) : [q];
      const counted = members.find((m) => answered(m.id)) ?? members.find((m) => marks[m.id].status === "PENDING") ?? members[0];
      units.push({
        counted: counted.id,
        max: Math.max(...members.map((m) => maxMarksFor(m, scheme))),
        answered: answered(counted.id) || marks[counted.id].status === "PENDING",
      });
    }

    // "Attempt any N": the N that count -- those answered first, then enough
    // unanswered ones to make N, so the chapters add up to the paper's total.
    let chosen = units.filter((u) => marks[u.counted].status !== "NOT_COUNTED");
    const limit = section.attemptLimit && section.attemptLimit > 0 ? section.attemptLimit : null;
    if (limit !== null) {
      const done = chosen.filter((u) => u.answered);
      const rest = chosen.filter((u) => !u.answered);
      chosen = [...done, ...rest].slice(0, limit);
    }
    for (const u of chosen) add(chapterOf[u.counted] ?? null, marks[u.counted].marks, u.max);
  });

  return Array.from(lines.values());
}
