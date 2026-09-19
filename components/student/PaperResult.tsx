import React from "react";
import { prisma } from "@/lib/prisma";
import { RichText } from "@/components/RichText";
import { MatrixColumns } from "@/components/MatrixColumns";
import { markPaper, type QuestionStatus, type ResponseValue } from "@/lib/marking";
import { normalizeScheme, parseAnswerKey, parseMatrixOptions, parseOptions, toMarkableSections } from "@/lib/paper";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, CircleDashed, CircleSlash, Clock, MinusCircle, XCircle } from "lucide-react";

const STATUS: Record<QuestionStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  CORRECT: { label: "Correct", className: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: CheckCircle2 },
  PARTIAL: { label: "Partly correct", className: "border-sky-200 bg-sky-50 text-sky-800", Icon: MinusCircle },
  WRONG: { label: "Wrong", className: "border-red-200 bg-red-50 text-red-800", Icon: XCircle },
  UNATTEMPTED: { label: "Not attempted", className: "border-brand-border bg-brand-page text-brand-ink/70", Icon: CircleDashed },
  NOT_COUNTED: { label: "Over the attempt limit", className: "border-amber-200 bg-amber-50 text-amber-800", Icon: CircleSlash },
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
export async function PaperResult({ assignmentId }: { assignmentId: string }) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      endedAt: true,
      autoSubmitted: true,
      test: {
        select: {
          id: true,
          markingScheme: true,
          resultRelease: true,
          resultsReleasedAt: true,
          sections: { orderBy: { position: "asc" }, include: { questions: { orderBy: { position: "asc" } } } },
          passages: { select: { id: true, content: true } },
        },
      },
      responses: { select: { questionId: true, value: true } },
    },
  });
  if (!assignment) return null;

  const { test } = assignment;
  const visible = test.resultRelease === "INSTANT" || test.resultsReleasedAt !== null;

  if (!visible) {
    return (
      <div className="space-y-2 rounded-xl border border-brand-border bg-white p-6 text-center shadow-card">
        <Clock className="mx-auto h-8 w-8 text-brand-blue" />
        <p className="font-heading text-base font-semibold text-brand-navy">Your answers are submitted</p>
        <p className="text-xs text-brand-ink/70">
          {assignment.endedAt ? `Submitted ${formatDate(assignment.endedAt)}. ` : ""}
          Your tutor will release the results; your score and the solutions will appear here.
        </p>
      </div>
    );
  }

  const scheme = normalizeScheme(test.markingScheme);
  const markable = toMarkableSections(test.sections, scheme);
  const answers: Record<string, ResponseValue> = {};
  for (const r of assignment.responses) answers[r.questionId] = r.value as ResponseValue;
  const marked = markPaper(markable, answers, scheme);
  const passages = new Map(test.passages.map((p) => [p.id, p.content]));

  const tally = { CORRECT: 0, PARTIAL: 0, WRONG: 0, UNATTEMPTED: 0, NOT_COUNTED: 0 } as Record<QuestionStatus, number>;
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

      {test.sections.map((section, si) => (
        <section key={section.id} className="space-y-3">
          <h2 className="font-heading text-base font-bold text-brand-navy">{section.title}</h2>
          {section.questions.map((q, qi) => {
            number++;
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
                    <span className="font-heading text-sm font-bold text-brand-navy">Q{number}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                      <status.Icon className="h-3 w-3" />
                      {status.label}
                    </span>
                    <span className="font-mono text-xs font-semibold text-brand-ink/70">{signed(mark.marks)}</span>
                    {q.bonus && <span className="text-[11px] font-semibold text-amber-700">Bonus question</span>}
                  </div>

                  <RichText text={q.stem} className="text-sm" />

                  {q.type === "MATRIX" ? (
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
                      <summary className="cursor-pointer text-xs font-semibold text-brand-navy">Solution</summary>
                      <RichText text={q.solution} className="mt-2" />
                    </details>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </section>
      ))}
    </div>
  );
}
