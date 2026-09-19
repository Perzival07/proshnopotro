import React from "react";
import { prisma } from "@/lib/prisma";
import { RichText } from "@/components/RichText";
import { MatrixColumns } from "@/components/MatrixColumns";
import { markPaper, maxMarksFor, type QuestionStatus, type ResponseValue } from "@/lib/marking";
import { normalizeScheme, parseAnswerKey, parseMatrixOptions, parseOptions, toMarkableSections } from "@/lib/paper";
import { formatDate } from "@/lib/utils";
import { parseTranslation } from "@/lib/translation";
import { MarkedSheets } from "@/components/student/MarkedSheets";
import { chapterBreakdown } from "@/lib/chapter-report";
import { resultsVisible } from "@/lib/results-visibility";
import { chapterVerdict, formatDuration, standing, summarizeAttempt } from "@/lib/analytics";
import { videoEmbed } from "@/lib/video";
import { CheckCircle2, CircleDashed, CircleSlash, Clock, MinusCircle, PenLine, XCircle } from "lucide-react";

const STATUS: Record<QuestionStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  CORRECT: { label: "Correct", className: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: CheckCircle2 },
  PARTIAL: { label: "Partly correct", className: "border-sky-200 bg-sky-50 text-sky-800", Icon: MinusCircle },
  WRONG: { label: "Wrong", className: "border-red-200 bg-red-50 text-red-800", Icon: XCircle },
  UNATTEMPTED: { label: "Not attempted", className: "border-brand-border bg-brand-page text-brand-ink/70", Icon: CircleDashed },
  NOT_COUNTED: { label: "Not counted", className: "border-amber-200 bg-amber-50 text-amber-800", Icon: CircleSlash },
  PENDING: { label: "Awaiting marking", className: "border-sky-200 bg-sky-50 text-sky-800", Icon: Clock },
  MARKED: { label: "Marked by your tutor", className: "border-brand-blue/30 bg-brand-tint text-brand-navy", Icon: PenLine },
};

function signed(n: number) {
  const v = Number(n.toFixed(2));
  return v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0";
}

function formatNumber(n: number) {
  return String(Number(n.toFixed(10)));
}

/**
 * A submitted attempt at a paper written in the portal: the score, and each
 * question with the student's answer beside the right one. Until the tutor
 * releases results (on a test set that way), only the fact of submission.
 *
 * Marks are worked out afresh from the current key, the same way the stored
 * score is, so a corrected key shows here at once.
 */
function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-brand-border bg-white p-3 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-blue">{label}</p>
      <p className="font-heading text-lg font-bold text-brand-navy">{value}</p>
      <p className="text-[11px] text-brand-ink/60">{note}</p>
    </div>
  );
}

export async function PaperResult({ assignmentId }: { assignmentId: string }) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      endedAt: true,
      dueAt: true,
      autoSubmitted: true,
      feedback: true,
      returnedAt: true,
      test: {
        select: {
          id: true,
          markingScheme: true,
          resultRelease: true,
          resultsReleasedAt: true,
          secondLanguage: true,
          sections: { orderBy: { position: "asc" }, include: { questions: { orderBy: { position: "asc" } } } },
          passages: { select: { id: true, content: true } },
        },
      },
      responses: { select: { questionId: true, value: true, manualMarks: true, feedback: true, timeSpentMs: true } },
    },
  });
  if (!assignment) return null;

  const { test } = assignment;
  const visible = resultsVisible(test, assignment);

  if (!visible) {
    return (
      <div className="space-y-2 rounded-xl border border-brand-border bg-white p-6 text-center shadow-card">
        <Clock className="mx-auto h-8 w-8 text-brand-blue" />
        <p className="font-heading text-base font-semibold text-brand-navy">Your answers are submitted</p>
        <p className="text-xs text-brand-ink/70">
          {assignment.endedAt ? `Submitted ${formatDate(assignment.endedAt)}. ` : ""}
          {test.resultRelease === "AFTER_DEADLINE"
            ? `Your score, the solutions and any video explanations appear here after the deadline, ${formatDate(assignment.dueAt)}.`
            : "Your tutor will release the results; your score and the solutions will appear here."}
        </p>
      </div>
    );
  }

  const scheme = normalizeScheme(test.markingScheme);
  // Written answers stay "awaiting marking" until the tutor returns the copy,
  // however far the marking has got, so a half-marked paper is never shown.
  const returned = assignment.returnedAt !== null;
  const manual = returned ? Object.fromEntries(assignment.responses.map((r) => [r.questionId, r.manualMarks])) : {};
  const feedback = new Map(returned ? assignment.responses.map((r) => [r.questionId, r.feedback]) : []);
  const markable = toMarkableSections(test.sections, scheme, manual);
  const answers: Record<string, ResponseValue> = {};
  for (const r of assignment.responses) answers[r.questionId] = r.value as ResponseValue;
  const marked = markPaper(markable, answers, scheme);
  const passages = new Map(test.passages.map((p) => [p.id, p.content]));

  // Marks by chapter, when the paper's questions are tagged.
  const chapterOf: Record<string, string | null> = {};
  for (const section of test.sections) for (const q of section.questions) chapterOf[q.id] = q.chapterId;
  const tagged = Object.values(chapterOf).some(Boolean);
  const byChapter = tagged ? chapterBreakdown(markable, marked, chapterOf, scheme) : [];
  const chapterNames = tagged
    ? new Map(
        (
          await prisma.chapter.findMany({
            where: { id: { in: byChapter.map((l) => l.chapterId).filter((id): id is string => !!id) } },
            select: { id: true, name: true, position: true },
          })
        ).map((c) => [c.id, c])
      )
    : new Map<string, { name: string; position: number }>();
  byChapter.sort(
    (a, b) => (a.chapterId ? chapterNames.get(a.chapterId)?.position ?? 999 : 1000) - (b.chapterId ? chapterNames.get(b.chapterId)?.position ?? 999 : 1000)
  );

  const summary = summarizeAttempt(marked);
  const myTime = new Map(assignment.responses.map((r) => [r.questionId, r.timeSpentMs]));
  const totalTime = assignment.responses.reduce((n, r) => n + r.timeSpentMs, 0);

  // Rank among everyone who sat this paper. With written answers it waits
  // until every copy has been returned, so an early rank cannot mislead.
  const hasWritten = test.sections.some((s) => s.questions.some((q) => q.type === "SUBJECTIVE"));
  const classmates = await prisma.assignment.findMany({
    where: { testId: test.id, status: "SUBMITTED" },
    select: { returnedAt: true, result: { select: { score: true } } },
  });
  const allReturned = classmates.every((c) => c.returnedAt !== null);
  const scores = classmates.map((c) => c.result?.score).filter((s): s is number => typeof s === "number");
  const place = (!hasWritten || allReturned) && scores.length > 1 ? standing(scores, marked.score) : null;

  // The class's average time on each question, to set the student's beside.
  const classTime = new Map(
    (
      await prisma.questionResponse.groupBy({
        by: ["questionId"],
        where: { assignment: { testId: test.id, status: "SUBMITTED" }, timeSpentMs: { gt: 0 } },
        _avg: { timeSpentMs: true },
      })
    ).map((g) => [g.questionId, g._avg.timeSpentMs ?? 0])
  );

  const tally = { CORRECT: 0, PARTIAL: 0, WRONG: 0, UNATTEMPTED: 0, NOT_COUNTED: 0, PENDING: 0, MARKED: 0 } as Record<QuestionStatus, number>;
  for (const s of marked.sections) for (const m of Object.values(s.questions)) tally[m.status]++;
  const percent = marked.maxScore > 0 ? Math.round((marked.score / marked.maxScore) * 1000) / 10 : 0;

  let number = 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-border bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Your score</p>
            <p className="font-heading text-3xl font-bold text-brand-navy">
              {formatNumber(marked.score)}
              <span className="text-lg font-semibold text-brand-ink/50"> / {formatNumber(marked.maxScore)}</span>
            </p>
            <p className="text-xs text-brand-ink/60">{percent}%</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            <span className="text-emerald-700">{tally.CORRECT} correct</span>
            {tally.PARTIAL > 0 && <span className="text-sky-700">{tally.PARTIAL} partly correct</span>}
            <span className="text-red-700">{tally.WRONG} wrong</span>
            <span className="text-brand-ink/60">{tally.UNATTEMPTED} not attempted</span>
            {tally.PENDING > 0 && <span className="text-sky-700">{tally.PENDING} written, awaiting marking</span>}
            {tally.MARKED > 0 && <span className="text-brand-navy">{tally.MARKED} written, marked</span>}
          </div>
        </div>

        {test.sections.length > 1 && (
          <table className="mt-4 w-full text-xs">
            <thead>
              <tr className="border-b border-brand-border text-left text-brand-ink/60">
                <th className="py-1.5 font-medium">Section</th>
                <th className="py-1.5 text-right font-medium">Attempted</th>
                <th className="py-1.5 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {test.sections.map((section, i) => (
                <tr key={section.id} className="border-b border-brand-border/50 last:border-0">
                  <td className="py-1.5 font-medium text-brand-navy">{section.title}</td>
                  <td className="py-1.5 text-right">
                    {marked.sections[i].attempted}/{section.attemptLimit ?? section.questions.length}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {formatNumber(marked.sections[i].score)} / {formatNumber(marked.sections[i].maxScore)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {place && (
          <Stat label="Rank" value={`${place.rank} of ${place.of}`} note={`${place.percentile} percentile`} />
        )}
        <Stat
          label="Accuracy"
          value={summary.accuracy === null ? "\u2014" : `${Math.round(summary.accuracy * 100)}%`}
          note={`${summary.correct} right of ${summary.attempted} answered`}
        />
        {totalTime > 0 && <Stat label="Time spent" value={formatDuration(totalTime)} note="on the questions" />}
        <Stat
          label="Negative marking"
          value={summary.negativeLost > 0 ? `\u2212${formatNumber(summary.negativeLost)}` : "0"}
          note={summary.negativeLost > 0 ? `marks lost to ${summary.wrong} wrong ${summary.wrong === 1 ? "answer" : "answers"}` : "no marks lost"}
        />
      </div>

      {byChapter.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-white p-5 shadow-card">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-blue">Strengths and weaknesses, by chapter</p>
          {(() => {
            const weak = byChapter.filter((l) => l.chapterId && chapterVerdict(l.scored, l.max) === "weak");
            return weak.length ? (
              <p className="mb-3 text-xs text-brand-ink/70">
                Work on: {weak.map((l) => chapterNames.get(l.chapterId!)?.name).filter(Boolean).join(", ")}.
              </p>
            ) : (
              <p className="mb-3 text-xs text-brand-ink/70">No weak chapters on this paper.</p>
            );
          })()}
          <table className="w-full text-xs">
            <tbody>
              {byChapter.map((line) => {
                const pct = line.max > 0 ? Math.max(0, line.scored / line.max) : 0;
                return (
                  <tr key={line.chapterId ?? "none"} className="border-b border-brand-border/50 last:border-0">
                    <td className="py-1.5 pr-2 text-brand-navy">
                      {line.chapterId ? chapterNames.get(line.chapterId)?.name ?? "Chapter" : "Other questions"}
                    </td>
                    <td className="w-28 py-1.5 pr-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-brand-tint">
                        <div
                          className={`h-full ${pct >= 0.75 ? "bg-emerald-500" : pct >= 0.4 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.round(pct * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="w-20 py-1.5 text-right font-mono">
                      {formatNumber(line.scored)} / {formatNumber(line.max)}
                    </td>
                    <td className="w-20 py-1.5 pl-2 text-right text-[10px] font-semibold">
                      {(() => {
                        const v = chapterVerdict(line.scored, line.max);
                        return v === "strong" ? (
                          <span className="text-emerald-700">Strong</span>
                        ) : v === "weak" ? (
                          <span className="text-red-700">Needs work</span>
                        ) : null;
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tally.PENDING > 0 && (
        <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          Your tutor is marking your written answers. Your score will include them once your marked copy is returned.
        </p>
      )}

      {returned && assignment.feedback && (
        <div className="rounded-xl border border-brand-blue/30 bg-brand-tint/40 p-4 text-sm text-brand-navy">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-blue">Your tutor&apos;s feedback</p>
          <p className="whitespace-pre-line">{assignment.feedback}</p>
        </div>
      )}

      {test.sections.map((section, si) => (
        <section key={section.id} className="space-y-3">
          <h2 className="font-heading text-base font-bold text-brand-navy">{section.title}</h2>
          {section.questions.map((q, qi) => {
            const alternative = !!q.choiceGroup && qi > 0 && section.questions[qi - 1].choiceGroup === q.choiceGroup;
            if (!alternative) number++;
            const mark = marked.sections[si].questions[q.id];
            const status = STATUS[mark.status];
            const key = parseAnswerKey(q.type, q.answerKey);
            const options = parseOptions(q.options);
            const given = answers[q.id] ?? null;
            const chosen = new Set(Array.isArray(given) ? given : given ? [given] : []);
            const right = new Set(key && (key.type === "SINGLE" || key.type === "MULTIPLE") ? key.options : []);
            const passage = q.passageId ? passages.get(q.passageId) : null;
            const firstOfPassage = passage && (qi === 0 || section.questions[qi - 1].passageId !== q.passageId);

            return (
              <React.Fragment key={q.id}>
                {firstOfPassage && (
                  <div className="rounded-lg border border-brand-blue/20 bg-brand-tint/40 p-3 text-sm">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-navy">Passage</p>
                    <RichText text={passage!} />
                  </div>
                )}
                <div className="space-y-3 rounded-xl border border-brand-border bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-sm font-bold text-brand-navy">
                      Q{number}
                      {alternative && <span className="ml-1 text-xs text-brand-blue">(OR)</span>}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                      <status.Icon className="h-3 w-3" />
                      {status.label}
                    </span>
                    <span className="font-mono text-xs font-semibold text-brand-ink/70">{signed(mark.marks)}</span>
                    {(myTime.get(q.id) ?? 0) > 0 && (
                      <span className="ml-auto text-[11px] text-brand-ink/60">
                        {formatDuration(myTime.get(q.id)!)}
                        {classTime.get(q.id) ? ` \u00b7 class average ${formatDuration(classTime.get(q.id)!)}` : ""}
                      </span>
                    )}
                    {q.bonus && <span className="text-[11px] font-semibold text-amber-700">Bonus question</span>}
                  </div>

                  <RichText text={q.stem} className="text-sm" />
                  {(() => {
                    const tr = test.secondLanguage ? parseTranslation(q.translation) : null;
                    if (!tr) return null;
                    const list = [...tr.options, ...tr.columns];
                    return (
                      <details className="rounded-md border border-dashed border-brand-blue/30 bg-brand-tint/30 px-3 py-2 text-sm">
                        <summary className="cursor-pointer text-xs font-semibold text-brand-navy">
                          Read in {test.secondLanguage}
                        </summary>
                        <div className="mt-2 space-y-2">
                          <RichText text={tr.stem} />
                          {list.length > 0 && (
                            <ul className="space-y-1">
                              {list.map((o) => (
                                <li key={o.id} className="flex gap-2">
                                  <span className="text-xs font-bold text-brand-navy">({o.id})</span>
                                  <RichText tall text={o.text} className="min-w-0 flex-1" />
                                </li>
                              ))}
                            </ul>
                          )}
                          {tr.solution && (
                            <div className="border-t border-brand-border/60 pt-2">
                              <p className="text-[11px] font-semibold text-brand-navy">Solution</p>
                              <RichText text={tr.solution} />
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })()}

                  {q.type === "SUBJECTIVE" ? (
                    <div className="space-y-1 text-xs">
                      <p className="text-brand-ink/70">
                        Written answer, {mark.status === "MARKED" ? `${formatNumber(mark.marks)} of ${formatNumber(maxMarksFor(markable[si].questions.find((m) => m.id === q.id)!, markable[si].scheme ?? scheme))} marks` : "not marked yet"}.
                      </p>
                      {feedback.get(q.id) && (
                        <p className="rounded-md border border-brand-blue/20 bg-brand-tint/40 p-2 text-brand-navy">
                          <span className="font-semibold">Tutor&apos;s comment: </span>
                          {feedback.get(q.id)}
                        </p>
                      )}
                    </div>
                  ) : q.type === "MATRIX" ? (
                    <div className="space-y-2">
                      <MatrixColumns {...parseMatrixOptions(q.options)} />
                      <table className="w-full max-w-md text-xs">
                        <thead>
                          <tr className="text-left text-brand-ink/60">
                            <th className="py-1 font-medium">Row</th>
                            <th className="py-1 font-medium">Your answer</th>
                            <th className="py-1 font-medium">Correct answer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parseMatrixOptions(q.options).rows.map((row) => {
                            const mine =
                              given && typeof given === "object" && !Array.isArray(given) ? given[row.id] ?? [] : [];
                            const correct = key?.type === "MATRIX" ? key.rows[row.id] ?? [] : [];
                            const ok = mine.length === correct.length && correct.every((c) => mine.includes(c));
                            return (
                              <tr key={row.id} className="border-t border-brand-border/60">
                                <td className="py-1 font-bold text-brand-navy">{row.id}</td>
                                <td className={`py-1 font-mono font-semibold ${mine.length === 0 ? "text-brand-ink/40" : ok ? "text-emerald-700" : "text-red-700"}`}>
                                  {mine.length ? mine.join(", ") : "\u2014"}
                                </td>
                                <td className="py-1 font-mono font-semibold text-emerald-800">{correct.join(", ")}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : options.length > 0 ? (
                    <ul className="space-y-1.5">
                      {options.map((o) => {
                        const isRight = right.has(o.id);
                        const isChosen = chosen.has(o.id);
                        return (
                          <li
                            key={o.id}
                            className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm ${
                              isRight
                                ? "border-emerald-300 bg-emerald-50"
                                : isChosen
                                  ? "border-red-300 bg-red-50"
                                  : "border-brand-border"
                            }`}
                          >
                            <span className="mt-0.5 shrink-0 text-xs font-bold text-brand-navy">({o.id})</span>
                            <RichText tall text={o.text} className="min-w-0 flex-1" />
                            <span className="shrink-0 text-[10px] font-semibold">
                              {isChosen && <span className={isRight ? "text-emerald-700" : "text-red-700"}>Your answer</span>}
                              {isRight && !isChosen && <span className="text-emerald-700">Correct answer</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-xs sm:max-w-sm">
                      <div className="rounded-md border border-brand-border p-2">
                        <p className="text-brand-ink/60">Your answer</p>
                        <p className="font-mono font-semibold">{typeof given === "string" && given ? given : "—"}</p>
                      </div>
                      <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2">
                        <p className="text-emerald-800">Correct answer</p>
                        <p className="font-mono font-semibold text-emerald-900">
                          {key?.type === "INTEGER"
                            ? key.values.join(" or ")
                            : key?.type === "DECIMAL"
                              ? key.min === key.max
                                ? formatNumber(key.min)
                                : `${formatNumber(key.min)} to ${formatNumber(key.max)}`
                              : "—"}
                        </p>
                      </div>
                    </div>
                  )}

                  {q.solution && (
                    <details className="rounded-md border border-brand-border bg-brand-page px-3 py-2 text-sm">
                      <summary className="cursor-pointer text-xs font-semibold text-brand-navy">
                        {q.type === "SUBJECTIVE" ? "Model answer" : "Solution"}
                      </summary>
                      <RichText text={q.solution} className="mt-2" />
                    </details>
                  )}
                  {q.videoUrl && videoEmbed(q.videoUrl) && (
                    <details className="rounded-md border border-brand-border bg-brand-page px-3 py-2 text-sm">
                      <summary className="cursor-pointer text-xs font-semibold text-brand-navy">Video explanation</summary>
                      {videoEmbed(q.videoUrl)!.embed ? (
                        <div className="mt-2 aspect-video overflow-hidden rounded-md bg-black">
                          <iframe
                            src={videoEmbed(q.videoUrl)!.embed!}
                            title={`Video explanation for question ${number}`}
                            className="h-full w-full border-0"
                            loading="lazy"
                            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                            referrerPolicy="strict-origin-when-cross-origin"
                          />
                        </div>
                      ) : (
                        <a href={videoEmbed(q.videoUrl)!.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-brand-blue underline">
                          Watch the explanation
                        </a>
                      )}
                    </details>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </section>
      ))}
      {returned && <MarkedSheets assignmentId={assignmentId} />}
    </div>
  );
}
