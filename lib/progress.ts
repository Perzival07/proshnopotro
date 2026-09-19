import { prisma } from "@/lib/prisma";
import { markPaper, type ResponseValue } from "@/lib/marking";
import { normalizeScheme, toMarkableSections } from "@/lib/paper";
import { chapterBreakdown } from "@/lib/chapter-report";
import { resultsVisible } from "@/lib/results-visibility";
import { standing } from "@/lib/analytics";

export interface ProgressPoint {
  assignmentId: string;
  testId: string;
  title: string;
  subject: string;
  seriesId: string | null;
  date: string;
  score: number;
  max: number;
  pct: number;
  rank: number | null;
  of: number | null;
  percentile: number | null;
}

export interface ProgressReport {
  name: string | null;
  points: ProgressPoint[];
  series: { id: string; name: string; points: ProgressPoint[] }[];
  chapters: { id: string; name: string; subject: string; scored: number; max: number }[];
}

/**
 * A student's results over time, as their progress page and their parent's
 * link show them. Only results the student may already see are included --
 * the same rules as the result page -- so a parent never sees more than the
 * student does.
 */
export async function studentProgress(email: string): Promise<ProgressReport> {
  const user = await prisma.user.findUnique({ where: { email }, select: { name: true } });
  const assignments = await prisma.assignment.findMany({
    where: { studentEmail: email, status: "SUBMITTED", result: { isNot: null }, test: { bank: false } },
    select: {
      id: true,
      dueAt: true,
      endedAt: true,
      returnedAt: true,
      result: { select: { score: true, maxScore: true, submittedAt: true } },
      responses: { select: { questionId: true, value: true, manualMarks: true } },
      test: {
        select: {
          id: true,
          title: true,
          subject: true,
          format: true,
          seriesId: true,
          series: { select: { id: true, name: true } },
          resultRelease: true,
          resultsReleasedAt: true,
          markingScheme: true,
          sections: { include: { questions: true } },
        },
      },
    },
  });

  // Which results the student can see, as on their dashboard.
  const visible = assignments.filter((a) => {
    if (a.test.format !== "QUESTIONS") return true;
    const written = a.test.sections.some((s) => s.questions.some((q) => q.type === "SUBJECTIVE"));
    return resultsVisible(a.test, a) && (!written || a.returnedAt !== null);
  });

  // Everyone's scores on those tests, for rank. A paper with written answers
  // ranks only once every copy is back.
  const testIds = Array.from(new Set(visible.map((a) => a.test.id)));
  const classmates = await prisma.assignment.findMany({
    where: { testId: { in: testIds }, status: "SUBMITTED" },
    select: { testId: true, returnedAt: true, result: { select: { score: true } } },
  });
  const byTest = new Map<string, { scores: number[]; allReturned: boolean }>();
  for (const c of classmates) {
    const t = byTest.get(c.testId) ?? { scores: [], allReturned: true };
    if (c.result) t.scores.push(c.result.score);
    if (!c.returnedAt) t.allReturned = false;
    byTest.set(c.testId, t);
  }

  const chapterTotals = new Map<string, { scored: number; max: number }>();
  const points: ProgressPoint[] = visible.map((a) => {
    const written = a.test.sections.some((s) => s.questions.some((q) => q.type === "SUBJECTIVE"));
    const t = byTest.get(a.test.id);
    const place = t && t.scores.length > 1 && (!written || t.allReturned) ? standing(t.scores, a.result!.score) : null;

    if (a.test.format === "QUESTIONS") {
      const scheme = normalizeScheme(a.test.markingScheme);
      const manual = Object.fromEntries(a.responses.map((r) => [r.questionId, r.manualMarks]));
      const answers: Record<string, ResponseValue> = {};
      for (const r of a.responses) answers[r.questionId] = r.value as ResponseValue;
      const markable = toMarkableSections(a.test.sections, scheme, manual);
      const chapterOf: Record<string, string | null> = {};
      for (const s of a.test.sections) for (const q of s.questions) chapterOf[q.id] = q.chapterId;
      for (const line of chapterBreakdown(markable, markPaper(markable, answers, scheme), chapterOf, scheme)) {
        if (!line.chapterId) continue;
        const c = chapterTotals.get(line.chapterId) ?? { scored: 0, max: 0 };
        c.scored += line.scored;
        c.max += line.max;
        chapterTotals.set(line.chapterId, c);
      }
    }

    const max = a.result!.maxScore;
    return {
      assignmentId: a.id,
      testId: a.test.id,
      title: a.test.title,
      subject: a.test.subject,
      seriesId: a.test.seriesId,
      date: (a.endedAt ?? a.result!.submittedAt).toISOString(),
      score: a.result!.score,
      max,
      pct: max > 0 ? Math.max(0, a.result!.score / max) : 0,
      rank: place?.rank ?? null,
      of: place?.of ?? null,
      percentile: place?.percentile ?? null,
    };
  });
  points.sort((x, y) => x.date.localeCompare(y.date));

  const seriesNames = new Map(visible.filter((a) => a.test.series).map((a) => [a.test.series!.id, a.test.series!.name]));
  const series = Array.from(seriesNames.entries()).map(([id, name]) => ({
    id,
    name,
    points: points.filter((p) => p.seriesId === id),
  }));

  const chapterRows = await prisma.chapter.findMany({
    where: { id: { in: Array.from(chapterTotals.keys()) } },
    select: { id: true, name: true, subject: true },
  });
  const chapters = chapterRows
    .map((c) => ({ ...c, ...chapterTotals.get(c.id)! }))
    .sort((a, b) => a.scored / (a.max || 1) - b.scored / (b.max || 1));

  return { name: user?.name ?? null, points, series, chapters };
}
