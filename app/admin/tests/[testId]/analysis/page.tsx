import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { markPaper, type QuestionStatus, type ResponseValue } from "@/lib/marking";
import { normalizeScheme, toMarkableSections } from "@/lib/paper";
import { chapterBreakdown } from "@/lib/chapter-report";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const fmt = (n: number) => String(Number(n.toFixed(1)));
const pctClass = (p: number) => (p >= 0.75 ? "bg-emerald-500" : p >= 0.4 ? "bg-amber-500" : "bg-red-500");

/**
 * How a class did on a paper written in the portal: by chapter, weakest
 * first, and question by question. Written answers count once marked.
 */
export default async function TestAnalysisPage({ params }: { params: { testId: string } }) {
  const test = await prisma.test.findUnique({
    where: { id: params.testId },
    select: {
      id: true,
      title: true,
      format: true,
      markingScheme: true,
      sections: { orderBy: { position: "asc" }, include: { questions: { orderBy: { position: "asc" } } } },
    },
  });
  if (!test || test.format !== "QUESTIONS") notFound();

  const attempts = await prisma.assignment.findMany({
    where: { testId: test.id, status: "SUBMITTED" },
    select: { responses: { select: { questionId: true, value: true, manualMarks: true } } },
  });

  const scheme = normalizeScheme(test.markingScheme);
  const chapterOf: Record<string, string | null> = {};
  for (const s of test.sections) for (const q of s.questions) chapterOf[q.id] = q.chapterId;

  const chapterTotals = new Map<string | null, { scored: number; max: number }>();
  const questionStats = new Map<string, { answered: number; right: number; marks: number; max: number }>();

  for (const attempt of attempts) {
    const manual = Object.fromEntries(attempt.responses.map((r) => [r.questionId, r.manualMarks]));
    const answers: Record<string, ResponseValue> = {};
    for (const r of attempt.responses) answers[r.questionId] = r.value as ResponseValue;
    const markable = toMarkableSections(test.sections, scheme, manual);
    const marked = markPaper(markable, answers, scheme);

    for (const line of chapterBreakdown(markable, marked, chapterOf, scheme)) {
      const t = chapterTotals.get(line.chapterId) ?? { scored: 0, max: 0 };
      t.scored += line.scored;
      t.max += line.max;
      chapterTotals.set(line.chapterId, t);
    }
    marked.sections.forEach((s) => {
      for (const [id, m] of Object.entries(s.questions)) {
        const st = questionStats.get(id) ?? { answered: 0, right: 0, marks: 0, max: 0 };
        const answeredStatuses: QuestionStatus[] = ["CORRECT", "PARTIAL", "WRONG", "MARKED"];
        if (answeredStatuses.includes(m.status)) st.answered++;
        if (m.status === "CORRECT") st.right++;
        st.marks += m.marks;
        questionStats.set(id, st);
      }
    });
  }

  const chapterIds = Array.from(chapterTotals.keys()).filter((id): id is string => !!id);
  const chapters = new Map(
    (await prisma.chapter.findMany({ where: { id: { in: chapterIds } }, select: { id: true, name: true } })).map((c) => [c.id, c.name])
  );
  const chapterRows = Array.from(chapterTotals.entries())
    .map(([id, t]) => ({ id, name: id ? chapters.get(id) ?? "Chapter" : "Untagged questions", pct: t.max > 0 ? t.scored / t.max : 0 }))
    .sort((a, b) => a.pct - b.pct);

  let number = 0;
  const questionRows = test.sections.flatMap((s) =>
    s.questions.map((q, i) => {
      const alternative = !!q.choiceGroup && i > 0 && s.questions[i - 1].choiceGroup === q.choiceGroup;
      if (!alternative) number++;
      const st = questionStats.get(q.id) ?? { answered: 0, right: 0, marks: 0, max: 0 };
      return {
        id: q.id,
        label: `Q${number}${alternative ? " (OR)" : ""}`,
        section: s.title,
        written: q.type === "SUBJECTIVE",
        chapter: q.chapterId ? chapters.get(q.chapterId) ?? "" : "",
        answered: st.answered,
        right: st.right,
        avg: attempts.length ? st.marks / attempts.length : 0,
      };
    })
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link href={`/admin/tests/${test.id}/questions`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-navy hover:text-brand-blue">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the paper
        </Link>
        <h1 className="mt-2 font-heading text-xl font-bold text-brand-navy">How the class did</h1>
        <p className="mt-0.5 text-xs text-brand-ink/60">
          {test.title} &middot; {attempts.length} submitted. Written answers count once marked.
        </p>
      </div>

      {attempts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-brand-border bg-white p-10 text-center text-xs text-brand-ink/60">
          Nobody has submitted this paper yet.
        </p>
      ) : (
        <>
          <section className="rounded-xl border border-brand-border bg-white p-5 shadow-card">
            <h2 className="mb-3 font-heading text-sm font-semibold text-brand-navy">By chapter, weakest first</h2>
            {chapterRows.length === 1 && chapterRows[0].id === null ? (
              <p className="text-xs text-brand-ink/60">Tag questions with chapters on the paper&apos;s page to see this.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {chapterRows.map((r) => (
                    <tr key={r.id ?? "none"} className="border-b border-brand-border/50 last:border-0">
                      <td className="py-1.5 pr-2 text-brand-navy">{r.name}</td>
                      <td className="w-40 py-1.5 pr-2">
                        <div className="h-2 overflow-hidden rounded-full bg-brand-tint">
                          <div className={`h-full ${pctClass(r.pct)}`} style={{ width: `${Math.max(0, Math.round(r.pct * 100))}%` }} />
                        </div>
                      </td>
                      <td className="w-14 py-1.5 text-right font-mono">{Math.round(r.pct * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-brand-border bg-white shadow-card">
            <h2 className="border-b border-brand-border px-5 py-3 font-heading text-sm font-semibold text-brand-navy">Question by question</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-brand-page text-left text-brand-ink/60">
                  <th className="px-5 py-2 font-medium">Question</th>
                  <th className="py-2 font-medium">Chapter</th>
                  <th className="py-2 text-right font-medium">Answered</th>
                  <th className="py-2 text-right font-medium">Right</th>
                  <th className="px-5 py-2 text-right font-medium">Average marks</th>
                </tr>
              </thead>
              <tbody>
                {questionRows.map((r) => (
                  <tr key={r.id} className="border-t border-brand-border/50">
                    <td className="px-5 py-1.5 font-semibold text-brand-navy">
                      {r.label} <span className="font-normal text-brand-ink/50">{r.section}</span>
                    </td>
                    <td className="max-w-[220px] truncate py-1.5 text-brand-ink/70">{r.chapter}</td>
                    <td className="py-1.5 text-right">{r.answered}/{attempts.length}</td>
                    <td className="py-1.5 text-right">{r.written ? "—" : `${r.right}/${attempts.length}`}</td>
                    <td className="px-5 py-1.5 text-right font-mono">{fmt(r.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
